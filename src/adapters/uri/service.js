'use strict';

const path    = require('path'),
      async   = require('async'),
      Browser = require('zombie'),
      util    = require('util'),
      cheerio = require('cheerio'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      RequestClient = require('../../utils/requestClient'),
      Errors        = require('../../utils/errors'),
      Util          = require('../../utils/util');

const HOST                  = "www.urionlinejudge.com.br",
      LOGIN_PAGE_PATH       = "/judge/pt/login",
      SUBMIT_PAGE_PATH      = "/judge/pt/runs/add",
      SUBMISSIONS_API_UNF   = "/judge/maratonando/%s/runs/%s";

const LOGIN_TEST_REGEX = /Perfil/i;

const TYPE = path.basename(__dirname);

module.exports = (function(parentCls) {

  function AdapterURI(acct) {
    parentCls.call(this, acct);

    AdapterURI.accessKey = acct.getAccessKey();

    const browser = new Browser({runScripts: false, strictSSL: false});
    const client = new RequestClient('https', HOST);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit("https://" + HOST + LOGIN_PAGE_PATH, next);
        },
        (next) => {
          browser
            .fill('#email', acct.getUser())
            .fill('#password', acct.getPass())
            .check('#remember-me')
            .pressButton('input.send-green', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!html.match(LOGIN_TEST_REGEX)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    }

    this._login = login;

    function getSubmissionId(callback) {
      let url = util.format(SUBMISSIONS_API_UNF, AdapterURI.accessKey, 10);
      client.get(url, {json: true}, (err, res, data) => {
        if (err || !_.isArray(data)) return callback(err);
        for (let i = 0; i < data.length; i++) {
          if (data[i].UserID.toString() === acct.getId()) {
            return callback(null, data[i].SubmissionID.toString());
          }
        }
        return callback(Errors.SubmissionFail);
      });
    };

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit("https://" + HOST + SUBMIT_PAGE_PATH, next)
        },
        (next) => {
          browser
            .fill('#problem-id', submission.problemId)
            .select('#language-id', submission.language)
            .fill('#source-code', submission.code)
            .pressButton('input.send-green', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (err) {
          return callback(err);
        } else if (browser.location.pathname === LOGIN_PAGE_PATH) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(callback);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let url = util.format(SUBMISSIONS_API_UNF, AdapterURI.accessKey, 100);
      client.get(url, {json: true}, (err, res, data) => {
        if (err) return callback(err);
        for (let i = 0; i < data.length; i++) {
          if (judgeSet[data[i].SubmissionID]) {
            judgeSet[data[i].SubmissionID].verdict = data[i].Verdict;
          }
        }
        return callback();
      });
    };

    this._judge = judge;
  }

  // Problems Fetcher
  (function(obj) {
    const PROBLEMSET_API_UNF = "/judge/maratonando/%s/problems";

    const client = new RequestClient('https', HOST);

    const TIMELIMIT_PATTERN = /Timelimit:\s+([\d.,]+)/;

    obj.import = (problem, callback) => {
      let url = Config.getProblemPath(problem.id);
      client.get(url, (err, res, html) => {
        if (err) return callback(err);
        let data = {};
        try {
          html = html.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
          let $ = cheerio.load(html);
          Util.adjustImgSrcs($, url);
          $('a').each((i, elem) => {
            elem = $(elem);
            let href = elem.attr('href')
            if (href && href[0] === '/') {
              elem.attr('href', '//' + HOST + href)
            }
          });
          $('script').remove();
          data.source = $('div.header p').html();
          let tl = $.html().match(TIMELIMIT_PATTERN);
          if (tl) data.timelimit = parseFloat(tl[1]);
          //data.memorylimit = '512 MB';
          $('div.header').remove();
          data.html = '<div class="problem-statement">' + $('body').html(); + '</div>';
        } catch (err) {
          return callback(err);
        }
        return callback(null, data);
      });
    }

    obj.fetchProblems = (callback) => {
      if (!AdapterURI.accessKey) {
        return callback();
      }
      let problems = [];
      let url = util.format(PROBLEMSET_API_UNF, AdapterURI.accessKey);
      async.waterfall([
        (next) => {
          client.get(url, {json: true}, next);
        },
        (res, data, next) => {
          try {
            for (let i = 0; i < data.length; i++) {
              if (data[i].ProblemID && data[i].Name) {
                problems.push({
                  id: data[i].ProblemID + '',
                  name: data[i].Name,
                  oj: TYPE
                });
              }
            }
            return next(null, problems);
          } catch (err) {
            return next(err);
          }
        }
      ], callback);
    }
  })(AdapterURI);

  return AdapterURI;
})(Adapter);
