'use strict';

const path      = require('path'),
      async     = require('async'),
      Browser   = require('zombie'),
      assert    = require('assert'),
      cheerio   = require('cheerio'),
      util      = require('util'),
      fs        = require('fs'),
      _         = require('lodash')

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils         = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PATH  = path.join(__dirname, "login.html"),
      SUBMIT_PATH = path.join(__dirname, "submit.html");

const STATUS_PATH = "/status";

const LOGIN_TEST_ANTI_REGEX     = /sign\s+up/i,
      AUTH_REQUIRED_TEST_REGEX  = /authori[sz]ation\s+required/i,
      WRONG_LANGUAGE_REGEX      = /submit\s+in\s+this\s+language/i;

module.exports = (function(parentCls) {

  function AdapterSPOJBR(acct) {
    parentCls.call(this, acct);

    const browser = new Browser({runScripts: false, strictSSL: false});
    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit("file://" + LOGIN_PATH, next);
        },
        (next) => {
          browser
            .fill('login_user', acct.getUser())
            .fill('password', acct.getPass())
            .check('autologin')
            .pressButton('submit', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!!html.match(LOGIN_TEST_ANTI_REGEX)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    this._login = login;

    function getSubmissionId(callback) {
      let id;
      try {
        let $ = cheerio.load(browser.html() || '');
        id = $('input[name="newSubmissionId"]').val();
        assert(id && id.length >= 6);
      } catch (e) {
        return callback(e);
      }
      return callback(null, id);
    };

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit('file://' + SUBMIT_PATH, next);
        },
        (next) => {
          browser
            .fill('input[name="problemcode"]', submission.problemId)
            .select('select[name="lang"]', submission.language)
            .fill('textarea', submission.code)
            .pressButton('input[value="Send"]', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (err) {
          return callback(err);
        } else if (html.match(AUTH_REQUIRED_TEST_REGEX)) {
          if (!retry) {
            return callback(Errors.LoginFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        } else if (html.match(WRONG_LANGUAGE_REGEX)) {
          return callback(Errors.InternalError);
        } else {
          return getSubmissionId(callback);
        }
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      client.get(STATUS_PATH + '/' + acct.getUser(), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          try {
            let data = $("#statusres_" + id).attr('status');
            if (data) judgeSet[id].verdict = data;
          } catch (err) {}
        }
        return callback();
      });
    };

    this._judge = judge;
  }
  
  return AdapterSPOJBR;
})(Adapter);
