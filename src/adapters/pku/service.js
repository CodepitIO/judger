'use strict';

const async   = require('async'),
      assert  = require('assert'),
      path    = require('path'),
      cheerio = require('cheerio'),
      util    = require('util'),
      iconv   = require('iconv-lite'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util');

const LOGIN_PATH        = "/login",
      SUBMIT_PATH       = "/submit",
      SUBMISSIONS_PATH  = "/status?user_id=%s";

const LOGGED_PATTERN          = /Log\s+Out/i,
      LOGIN_FORM_PATTERN      = /<form([^>]+?action\s*=\s*["']?\w*login[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      NOT_AUTHORIZED_PATTERN  = /Please\s+login\s+first/i;

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterPKU(acct) {
    parentCls.call(this, acct);

    let client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          client.get(LOGIN_PATH, next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(LOGIN_FORM_PATTERN, html);
            f.data[f.userField] = acct.getUser();
            f.data[f.passField] = acct.getPass();
            opts = {
              followAllRedirects: true,
              headers: { Referer: Config.url, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(LOGIN_PATH, f.data, opts, next);
        }
      ], (err, res, html) => {
        html = html || '';
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    this._login = login;

    function getSubmissionId(html, callback) {
      let id;
      try {
        let $ = cheerio.load(html);
        let elem = $('table.a tr:nth-child(2)');
        if (elem.find('td:nth-child(2) a').text() === acct.getUser()) {
          id = elem.find('td:first-child').text();
        }
       assert(id && id.length >= 6);
      } catch (e) {
        return callback(e);
      }
      return callback(null, id);
    };

    function send(submission, retry, callback) {
      let data = {
        problem_id: submission.problemId,
        source: new Buffer(submission.code).toString('base64'),
        language: submission.language,
        submit: 'Submit',
        encoded: '1',
      };
      let opts = {
        headers: {
          Referer: Config.url + SUBMIT_PATH,
        },
      };
      client.post(SUBMIT_PATH, data, opts, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        if (html.match(NOT_AUTHORIZED_PATTERN)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(html, callback);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      client.get(util.format(SUBMISSIONS_PATH, acct.getUser()), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = data.nextAll().eq(4);
            if (!data.find('a').html()) {
              data = data.html();
            } else {
              data = data.find('a').html();
            }
            judgeSet[id].verdict = data;
          } catch(e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  // Problems Fetcher
  (function(obj) {
    const client = new RequestClient(Config.url);

    const PROBLEMS_PATH_UNF = "/problemlist?volume=%s";

    const TIMELIMIT_PATTERN = /time\s*limit:\s*([\d.,]+)\s*\w/i;
    const MEMOLIMIT_PATTERN = /memory\s*limit:\s*([\d\w\s]+)/i;

    obj.import = (problem, callback) => {
      let urlPath = Config.getProblemPath(problem.id);
      client.get(urlPath, (err, res, html) => {
        if (err) return callback(err);
        let data = {};
        try {
          data.supportedLangs = Config.getSupportedLangs();
          html = html.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
          let $ = cheerio.load(html);
          Util.adjustImgSrcs($, Config.url);
          Util.adjustAnchors($, Config.url);
          let header = $('.plm');
          let match;
          if (match = header.text().match(TIMELIMIT_PATTERN)) {
            data.timelimit = parseFloat(match[1]) / 1000.;
          }
          if (match = header.text().match(MEMOLIMIT_PATTERN)) {
            data.memorylimit = Math.round(parseFloat(match[1]) / 1024.) + ' MB';
          }
          let body = '<div class="pku-problem">';
          let parent = $('p.pst').parent();
          if (parent.children().slice(-2).html() === 'Source') {
            data.source = parent.children().slice(-1).text();
          }
          parent.children().slice(0,4).remove();
          if (data.source) {
            parent.children().slice(-2).remove();
          }
          body += parent.html();
          body += '</div>';
          data.html = body;
        } catch (err) {
          return callback(err);
        }
        return callback(null, data);
      });
    }

    function processProblems(problemsPath, problems, callback) {
      client.get(problemsPath, (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        let problemsList = $('form').next().children('tr');
        if (problemsList.length <= 1) {
          return callback(new Error("No problems to parse"));
        }
        let problemMatches = problemsList.each((i, item) => {
          if (i == 0) return;
          try {
            let id = $(item).children().eq(0).text();
            let name = $(item).children().eq(1).text();
            if (id && name) {
              problems.push({
                id: id,
                name: name,
                oj: TYPE
              });
            }
          } catch (e) {}
        });
        return callback(null, problems);
      });
    }

    obj.fetchProblems = (callback) => {
      let problems = [];
      let idx = 1;
      async.forever(
        (next) => {
          let problemsPath = util.format(PROBLEMS_PATH_UNF, idx);
          idx = idx + 1;
          return processProblems(problemsPath, problems, next);
        },
        (err) => {
          return callback(null, problems);
        }
      );
    }
  })(AdapterPKU);

  return AdapterPKU;
})(Adapter);
