const path = require('path'),
      async = require('async'),
      Browser = require('zombie'),
      assert = require('chai').assert,
      cheerio = require('cheerio');

const RequestClient = require('../utils/requestClient'),
      util = require('../utils/util'),
      Adapter = require('../adapters/adapter');
      config = require('../config/defaults'),
      errors = require('../utils/errors');

const SPOJ_LOGIN_PATH = path.join(__dirname, "..", "resources", "spoj_login.html"),
      SPOJ_SUBMIT_PATH = path.join(__dirname, "..", "resources", "spoj_submit.html");

const SPOJ_HOST = "www.spoj.com",
      SUBMISSIONS_PATH = '/status';

// Options and global variables
const options = {
  runScripts: false,
  waitDuration: "15s"
};

const LOGIN_TEST_ANTI_REGEX = /sign\s+up/i,
      AUTH_REQUIRED_TEST_REGEX = /authori[sz]ation\s+required/i,
      WRONG_LANGUAGE_REGEX = /submit\s+in\s+this\s+language/i;

const OJ_NAME = "spoj",
      CONFIG = config.oj[OJ_NAME],
      WORKER_BROWSERS = CONFIG.submissionWorkersPerAdapter || 1;

module.exports = (function(parentCls) {
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        var that = this;

        // public attributes and functions
        this._send = function(probNum, codeString, language, tryLogin, callback) {
          var langVal = CONFIG.submitLang[language];
          if (!langVal) return callback(errors.InvalidLanguage);
          sendQueue.push({probNum: probNum, language: langVal, codeString: codeString}, callback);
        };

        var spojClient = new RequestClient('http', SPOJ_HOST);
        this._judge = function(submissions, callback) {
            async.waterfall([
                function(subCallback){
                    spojClient.get(SUBMISSIONS_PATH + '/' + acct.getUser(), subCallback);
                },
                function(res, html, subCallback) {
                    html = html || '';
                    if (!html) return subCallback();
                    var $ = cheerio.load(html);
                    for (var id in submissions) {
                      var data = null;
                      try {
                        var data = $("#statusres_" + id).attr('status');
                      } catch (err) {}
                      that.events.emit('verdict', id, data);
                    }
                    return subCallback();
                }
            ], callback);
        };

        // private attributes and functions
        var browsers = [];

        var _login = function(browser, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("file://" + SPOJ_LOGIN_PATH, subCallback);
            },
            function(subCallback) {
              browser
                .fill('login_user', acct.getUser())
                .fill('password', acct.getPass())
                .check('autologin')
                .pressButton('submit', subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            return callback(null, !html.match(LOGIN_TEST_ANTI_REGEX));
          });
        };

        var _getSubmissionId = function(html, callback) {
          try {
            var $ = cheerio.load(html);
            var id = $('input[name="newSubmissionId"]').val();
            assert(id && id.length >= 6, 'submission id is valid');
          } catch (e) {
            return callback(e);
          }
          return callback(null, id);
        };

        var _internalSend = function(browser, probNum, codeString, language, tryLogin, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit('file://' + SPOJ_SUBMIT_PATH, subCallback);
            },
            function(subCallback) {
              browser
                .fill('input[name="problemcode"]', probNum)
                .select('select[name="lang"]', language)
                .fill('textarea', codeString)
                .pressButton('input[value="Send"]', subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            if (err) {
                return callback(err);
            } else if (html.match(AUTH_REQUIRED_TEST_REGEX)) {
                if (!tryLogin) {
                    return callback(errors.LoginFail);
                } else {
                    return _login(browser, function(err, logged) {
                        if (!logged) return callback(errors.LoginFail);
                        return _internalSend(browser, probNum, codeString, language, false, callback);
                    });
                }
            } else if (html.match(WRONG_LANGUAGE_REGEX)) {
              return callback(errors.InvalidSubmission);
            } else {
              return _getSubmissionId(html, callback);
            }
          });
        };

        var _getAvailableBrowser = function() {
          for (var i = 0; i < browsers.length; i++) {
            if (!browsers[i].tabs) {
              browsers[i] = new Browser(options);
              browser[i]._available = true;
            }
            if (browsers[i]._available) {
              browsers[i]._available = false;
              return browsers[i];
            }
          }
          var browser = new Browser(options);
          browsers.push(browser);
          return browser;
        };

        var _releaseBrowser = function(browser) {
          browser._available = true;
        };

        var sendQueue = async.queue(function (sub, callback) {
          var browser = _getAvailableBrowser();
          _internalSend(browser, sub.probNum, sub.codeString, sub.language, true, function(err, submissionId) {
            _releaseBrowser(browser);
            return callback(err, submissionId);
          });
        }, WORKER_BROWSERS);

    }

    return cls;
})(Adapter);
