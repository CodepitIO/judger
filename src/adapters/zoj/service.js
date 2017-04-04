'use strict';

const async   = require('async'),
      assert  = require('assert'),
      path    = require('path'),
      cheerio = require('cheerio'),
      util    = require('util'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util');

const LOGIN_PATH        = "/onlinejudge/login.do",
      SUBMIT_PATH       = "/onlinejudge/submit.do",
      SUBMISSIONS_PATH  = "/onlinejudge/showRuns.do?contestId=1&handle=%s";

const LOGGED_PATTERN      = /Logout/i,
      SUBMISSION_PATTERN  = /submission\s+id\s+is[^\d]+(\d+)/i,
      PROBLEMS_PATTERN    = /p\(\d+,\d+,(\d+),"([^"]+)",.+\)/ig;

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterZOJ(acct) {
    parentCls.call(this, acct);

    let client = new RequestClient(Config.url);

    function login(callback) {
      let data = {
        handle: acct.getUser(),
        password: acct.getPass(),
        rememberMe: 'on',
      };
      client.post(LOGIN_PATH, data, {}, (err, res, html) => {
        html = html || '';
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    this._login = login;

    function send(submission, retry, callback) {
      let data = {
        problemId: submission.problemId,
        languageId: submission.language,
        source: submission.code,
      };
      client.post(SUBMIT_PATH, data, {}, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        let id = SUBMISSION_PATTERN.exec(html);
        id = id && id[1];
        if (!id) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return callback(null, id);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let submissionsPath = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissionsPath, (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td.runId:contains("' + id + '")');
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

    const PROBLEMS_PATH_UNF = "/onlinejudge/showProblems.do?contestId=1&pageNumber=%s";

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
          data.timelimit = parseFloat(html.match(TIMELIMIT_PATTERN)[1])
          data.memorylimit = Math.round(parseFloat(html.match(
            MEMOLIMIT_PATTERN)[1]) / 1024.) + ' MB';
          let $ = cheerio.load(html);
          Util.adjustAnchors($, Config.url + urlPath);
          let body = $('#content_body');
          $('b').replaceWith(function () {
            if (/(input|output|hint|task|introduction)/i.exec($(this).text()) &&
                  $(this).text().length < 25) {
              return "<div class='section-title'>" + $(this).html() + "</div>";
            }
            return $(this).html();
          });
          body.children().slice(0,4).remove();
          html = body.html();
          let author = /\s*Author[^<]*<strong>([^<]*)<\/strong>/.exec(html);
          author = author && author[1];
          let source = /\s*Source[^<]*<strong>([^<]*)<\/strong>/.exec(html);
          source = source && source[1];
          html = html.replace(/\s+<hr>[\s\S]*?$/, '');
          assert(html.length > 0);
          html =
            '<div class="zoj-problem problem-statement ttypography">' +
              html +
            '</div>' +
            '<script>' +
              '$(function() { MathJax.Hub.Typeset("zoj"); });' +
            '</script>';
          if (author || source) {
            data.source = 'Source: ' +
              ((author && source && `${source} (${author})`) || author || source);
          }
          data.html = html;
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
        let problemsList = $('table.list').find('tr');
        if (problemsList.length <= 1) {
          return callback(new Error("No problems to parse"));
        }
        let error = null;
        let problemMatches = problemsList.each((i, item) => {
          if (i == 0) return;
          try {
            let id = $(item).find('.problemId').text();
            if (problems.length > 0 && parseInt(_.last(problems).id) > parseInt(id)) {
              throw new Error("No problems to parse");
            }
            let name = $(item).find('.problemTitle').text();
            if (id && name) {
              problems.push({
                id: id,
                name: name,
                oj: TYPE
              });
            }
          } catch (e) {
            error = e;
          }
        });
        return callback(error, problems);
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
  })(AdapterZOJ);

  return AdapterZOJ;
})(Adapter);
