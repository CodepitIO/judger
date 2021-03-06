'use strict';

const path    = require('path'),
      async   = require('async'),
      assert  = require('assert'),
      Browser = require('zombie'),
      util    = require('util'),
      cheerio = require('cheerio'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils         = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PAGE_PATH       = "/judge/pt/login",
      SUBMIT_PAGE_PATH      = "/judge/pt/runs/add",
      SUBMISSIONS_API_UNF   = "/judge/maratonando/%s/runs/%s";

const LOGIN_TEST_REGEX = /Perfil/i;

module.exports = (function(parentCls) {

  function AdapterURI(acct) {
    parentCls.call(this, acct);

    AdapterURI.accessKey = acct.getAccessKey();

    const browser = new Browser({runScripts: false, strictSSL: false});
    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + LOGIN_PAGE_PATH, next);
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
    }

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
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
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

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
    }

    this._judge = judge;
  }

  return AdapterURI;
})(Adapter);
