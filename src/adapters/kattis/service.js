'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      iconv   = require('iconv-lite'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util');

const HOST              = "open.kattis.com",
      LOGIN_PATH        = "/login/email?",
      SUBMIT_PATH       = "/submit",
      SUBMISSIONS_PATH  = "/users/%s";

const LOGGED_PATTERN          = /My\s+Profile/i,
      NOT_FOUND_PATTERN       = /404:\s+Not\s+Found/i,
      OUT_OF_TOKENS_PATTERN   = /out\s+of\s+submission\s+tokens.\s+your\s+next\s+token\s+will\s+regenerate\s+in\s+(\d+)/i,
      LOGIN_FORM_PATTERN      = /<form([^>]+?action\s*=\s*["']?[^>]*login[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SUBMIT_PROBLEM_PATTERN  = /<form([^>]+?id\s*=\s*["']?[^>]*submit-solution-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      NOT_AUTHORIZED_PATTERN  = /requires\s+you\s+to\s+be\s+logged/i;

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterKATTIS(acct) {
    parentCls.call(this, acct);

    const client = new RequestClient('https', HOST);

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
              headers: { Referer: 'https://' + HOST, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(f.action, f.data, opts, next);
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

    function getSubmissionID(html, callback) {
      let id;
      try {
        let $ = cheerio.load(html);
        id = $('td.submission_id a').html();
        assert(id && id.length >= 6);
      } catch (e) {
        return callback(Errors.SubmissionFail);
      }
      return callback(null, id);
    }

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          client.get(SUBMIT_PATH, next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(SUBMIT_PROBLEM_PATTERN, html);
            f.data['problem'] = submission.problemId;
            f.data['sub_code'] = submission.code;
            f.data['language'] = submission.language;
            f.data['type'] = 'editor';
            if (submission.language === 'Java') {
              f.data['mainclass'] = 'Main';
            }
            opts = {
              followAllRedirects: true,
              headers: { Referer: 'https://' + HOST, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(f.action, f.data, opts, next);
        },
      ], (err, res, html) => {
        html = html || '';
        if (err || html.match(NOT_AUTHORIZED_PATTERN)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        let match;
        if (match = html.match(OUT_OF_TOKENS_PATTERN)) {
          if (!retry) return callback(Errors.SubmissionFail);
          let secs = parseInt(match[1]) * 1000;
          return setTimeout(() => {
            return send(submission, false, callback);
          }, secs);
        }
        return getSubmissionID(html, callback);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let submissions_path = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissions_path, (err, res, html) => {
        html = html || '';
        if (!!html.match(NOT_FOUND_PATTERN)) {
          return login(callback);
        }
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td.submission_id:contains("' + id + '")');
            data = data.nextAll().eq(2).text();
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
    const PROBLEMS_PATH_UNF = "/problems/?page=%s";
    const PROBLEM_ID_PATTERN = /\/problems\/(.*)/i;

    const TIMELIMIT_PATTERN = /CPU\s+Time\s+limit:\s+(.+)\s+second/i;
    const MEMOLIMIT_PATTERN = /Memory\s+limit:\s+(\d+)\s*([a-zA-Z]{1,2})/i;
    const AUTHOR_PATTERN    = /Author.+:\s+(.*)\s+/i;
    const SOURCE_PATTERN    = /Source:\s+(.*)\s+/i;

    const client = new RequestClient('https', HOST);

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
          let header = $('.problem-sidebar');
          let match;
          if (match = header.text().match(TIMELIMIT_PATTERN)) {
            data.timelimit = parseFloat(match[1]);
          }
          if (match = header.text().match(MEMOLIMIT_PATTERN)) {
            data.memorylimit = `${match[1]} ${match[2]}`;
          }
          let src1 = null, src2 = null;
          if (match = header.text().match(AUTHOR_PATTERN)) {
            src1 = _.trim(match[1]);
          }
          if (match = header.text().match(SOURCE_PATTERN)) {
            src2 = _.trim(match[1]);
          }
          data.source = (src1 && src2) ? `${src1} (${src2})` : src1 || src2;
          data.html =
            '<div id="kattis" class="kattis-problem">' +
              $('.problembody').html() +
            '</div>' +
            '<script>' +
              '$(function() { MathJax.Hub.Typeset("kattis"); });' +
            '</script>';
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
        let problemMatches = $('tbody td.name_column');
        if (problemMatches.length === 0) return callback(new Error());
        problemMatches.each((i, elem) => {
          try {
            let id = $(elem).find('a').attr('href');
            id = PROBLEM_ID_PATTERN.exec(id)[1];
            let name = $(elem).text();
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
      let idx = 0;
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
  })(AdapterKATTIS);

  return AdapterKATTIS;
})(Adapter);
