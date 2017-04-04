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

const SUBMIT_PATH       = "/toj/submit_process.php",
      SUBMISSIONS_PATH  = "/toj/status.php?user=%s";

const SUBMITTED_PATTERN  = /source\s+code\s+has\s+been\s+submitted/i,
      SUBMISSION_PATTERN = /<tr\s+align=center\s+height=\d+><td>(\d+)<\/td>/,
      PROBLEMS_PATTERN   = /p\(\d+,\d+,(\d+),"([^"]+)",.+\)/ig;

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterTOJ(acct) {
    parentCls.call(this, acct);

    let client = new RequestClient(Config.url);

    function login(callback) {
      return callback();
    };

    this._login = login;

    function getSubmissionId(callback) {
      let submissionsPath = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissionsPath, (err, res, html) => {
        if (err) {
          return callback(err);
        }
        html = html || '';
        let id;
        try {
          id = html.match(SUBMISSION_PATTERN)[1];
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(e);
        }
        return callback(null, id);
      })
    };

    function send(submission, retry, callback) {
      let data = {
        user_id: acct.getUser(),
        passwd: acct.getPass(),
        prob_id: submission.problemId,
        language: submission.language,
        source: submission.code,
      };
      client.post(SUBMIT_PATH, data, {}, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        if (!html.match(SUBMITTED_PATTERN)) {
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
      client.get(util.format(SUBMISSIONS_PATH, acct.getUser()), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = _.trim(data.nextAll().eq(1).text());
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

    const PROBLEMS_PATH_UNF = "/toj/list%s.html";

    const TIMELIMIT_PATTERN = /time\s*limit:[^\d]+([\d.,]+)/i;
    const MEMOLIMIT_PATTERN = /memory\s*limit:[^\d]+([\d.,]+)/i;

    obj.import = (problem, callback) => {
      let urlPath = Config.getProblemPath(problem.id);
      client.get(urlPath, (err, res, html) => {
        if (err) return callback(err);
        let data = {};
        try {
          data.supportedLangs = Config.getSupportedLangs();
          html = html.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
          let $ = cheerio.load(html);
          Util.adjustAnchors($, Config.url + urlPath);
          assert($('#problem').html().length > 0);
          let body =
            '<div class="toj-problem problem-statement ttypography">' +
              $('#problem').html() +
            '</div>' +
            '<script>' +
              '$(function() { MathJax.Hub.Typeset("toj"); });' +
            '</script>';
          let source = $('b:contains("Source")');
          if (source) {
            data.source = source.next().text();
          }
          data.timelimit = parseFloat(html.match(TIMELIMIT_PATTERN)[1])
          data.memorylimit = Math.round(parseFloat(html.match(
              MEMOLIMIT_PATTERN)[1]) / 1024.) + ' MB';
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
        let m;
        try {
          let atLeastOnce = false;
          do {
            m = PROBLEMS_PATTERN.exec(html);
            if (m) {
              atLeastOnce = true;
              let id = m[1];
              let name = _.replace(m[2], '\\', '');
              if (id && name) {
                problems.push({
                  id: id,
                  name: name,
                  oj: TYPE
                });
              }
            }
          } while (m);
          if (!atLeastOnce) throw new Error("list is over");
        } catch (e) {
          return callback(e);
        }
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
  })(AdapterTOJ);

  return AdapterTOJ;
})(Adapter);
