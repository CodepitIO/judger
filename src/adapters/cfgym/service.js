'use strict';

const path    = require('path'),
      async   = require('async'),
      Browser = require('zombie'),
      assert  = require('assert'),
      cheerio = require('cheerio'),
      util    = require('util'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils          = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PAGE_PATH   = "/enter",
      GYM_SUBMIT_PAGE_PATH  = "/gym/%s/submit",
      GROUP_SUBMIT_PAGE_PATH  = "/group/%s/contest/%s/submit",
      SUBMISSIONS_API   = "/api/user.status?handle=%s&count=%s";

const LOGIN_TEST_REGEX      = /logout/i,
      LLD_REGEX             = /preferred\s+to\s+use\s+cin/i;

module.exports = (function(parentCls) {

  function AdapterCF(acct) {
    parentCls.call(this, acct);

    let browser = new Browser({runScripts: false, strictSSL: false});
    let client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + LOGIN_PAGE_PATH, next)
        },
        (next) => {
          browser
            .fill('#handle', acct.getUser())
            .fill('#password', acct.getPass())
            .check('#remember')
            .pressButton('input[value="Login"]', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!html.match(LOGIN_TEST_REGEX)) {
          return callback(Errors.LoginFail);
        }
        return callback(null);
      });
    };

    this._login = login;

    function getSubmissionId(callback) {
      let submissionsUrl = util.format(SUBMISSIONS_API, acct.getUser(), 1);
      client.get(submissionsUrl, {json: true}, (err, res, data) => {
        let id;
        try {
          id = data.result[0].id + '';
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });
    };

    function send(submission, retry, callback) {
      let split = _.split(submission.problemId, '/');
      let submitPagePath, problemId;
      if (split.length === 3) {
        problemId = split[2];
        submitPagePath = util.format(GROUP_SUBMIT_PAGE_PATH, split[0], split[1]);
      } else {
        problemId = split[1];
        submitPagePath = util.format(GYM_SUBMIT_PAGE_PATH, split[0]);
      }
      async.waterfall([
        (next) => {
          browser.visit(Config.url + submitPagePath, next);
        },
        (next) => {
          if (browser.location.pathname === LOGIN_PAGE_PATH) {
            return next(Errors.LoginFail);
          }
          browser
            .select('select[name="submittedProblemIndex"]', problemId)
            .select('select[name="programTypeId"]', submission.language)
            .fill('#sourceCodeTextarea', submission.code)
            .pressButton('input[value="Submit"]', next);
        },
        (next) => {
          let html = browser.html() || '';
          if (html.match(LLD_REGEX)) {
            return browser.check('input[name="doNotShowWarningAgain"]')
              .pressButton('input[value="Submit"]', next);
          }
          return next();
        }
      ], (err) => {
        if (err && !retry) {
          return callback(err);
        } else if (browser.html().match(/should\s+satisfy\s+regex/i)) {
          return callback(Errors.UnretriableError);
        } else if (!browser.location.pathname.match(/\/my$/)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            browser = new Browser({runScripts: false});
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
      let submissionsUrl = util.format(SUBMISSIONS_API, acct.getUser(), 30);
      client.get(submissionsUrl, {json: true}, (err, res, data) => {
        data = data && data.result || [];
        for (let i = 0; i < data.length; i++) {
          if (judgeSet[data[i].id]) {
            judgeSet[data[i].id].verdict = data[i].verdict;
          }
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterCF;
})(Adapter);
