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
      SUBMIT_PAGE_PATH  = "/problemset/submit",
      STATUS_PATH       = "/problemset/status",
      SUBMISSIONS_API   = "/api/user.status?handle=%s&count=%s";

const LOGIN_TEST_REGEX      = /logout/i,
      LLD_REGEX             = /preferred\s+to\s+use\s+cin/i;

module.exports = (function(parentCls) {

  function AdapterCF(acct) {
    parentCls.call(this, acct);

    let browser = new Browser({runScripts: true, strictSSL: false, waitDuration: 100000});
    let client = new RequestClient(Config.url);

    function login(callback) {
      console.log('Logging to CF...');
      async.waterfall([
        (next) => {
          console.log(Config.url + LOGIN_PAGE_PATH);
          browser.visit(Config.url + LOGIN_PAGE_PATH, next)
        },
        (next) => {
          browser
            .fill('#handleOrEmail', acct.getUser())
            .fill('#password', acct.getPass())
            .check('#remember')
            .pressButton('input[value="Login"]', next);
        }
      ], (err) => {
        console.log(err);
        let html = browser.html() || '';
        if (!html.match(LOGIN_TEST_REGEX)) {
          console.log('CF login fail');
          return login(callback);
        }
        console.log('CF login succeed!');
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
      async.waterfall([
        (next) => {
          browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
        },
        (next) => {
          if (browser.location.pathname === LOGIN_PAGE_PATH) {
            return next(Errors.LoginFail);
          }
          browser
            .fill('input[name="submittedProblemCode"]', submission.problemId)
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
        } else if (browser.location.pathname !== STATUS_PATH) {
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
