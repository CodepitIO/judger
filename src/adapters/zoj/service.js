'use strict';

const async   = require('async'),
      assert  = require('assert'),
      path    = require('path'),
      cheerio = require('cheerio'),
      util    = require('util'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils         = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PATH        = "/onlinejudge/login.do",
      SUBMIT_PATH       = "/onlinejudge/submit.do",
      SUBMISSIONS_PATH  = "/onlinejudge/showRuns.do?contestId=1&handle=%s";

const LOGGED_PATTERN      = /Logout/i,
      SUBMISSION_PATTERN  = /submission\s+id\s+is[^\d]+(\d+)/i,
      PROBLEMS_PATTERN    = /p\(\d+,\d+,(\d+),"([^"]+)",.+\)/ig;

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

  return AdapterZOJ;
})(Adapter);
