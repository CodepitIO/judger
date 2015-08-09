const path = require('path');
const async = require('async');
const Browser = require('zombie');
const cheerio = require('cheerio');

const util = require('../utils/util');
const Adapter = require('../adapters/adapter');

const SPOJBR_LOGIN_PATH = path.join(__dirname, "resources", "spojbr_login.html");
const SPOJBR_SUBMIT_PATH = path.join(__dirname, "resources", "spojbr_submit.html");

// Options and global variables
const options = {
  runScripts: false,
  loadCSS: false,
  maxWait: "30s"
};

const LOGIN_TEST_REGEX = /minha\s+conta/i;
const AUTH_REQUIRED_TEST_REGEX = /authori[sz]ation\s+required/i;
const WRONG_LANGUAGE_REGEX = /submit\s+in\s+this\s+language/i;

const WORKER_BROWSERS = 3;

module.exports = (function(parentCls) {
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        this.browsers = [];
        var that = this;

        this._login = function(browser, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("file://" + SPOJBR_LOGIN_PATH).then(subCallback);
            },
            function(subCallback) {
              browser
                .fill('login_user', acct.user())
                .fill('password', acct.pass())
                .check('autologin')
                .pressButton('submit')
                .then(subCallback)
                .catch(subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            return callback(null, !!html.match(LOGIN_TEST_REGEX));
          });
        };

        this._getSubmissionId = function(browser, html, callback) {
          var $ = cheerio.load(html);
          var submissionId = $('input[name="newSubmissionId"]').val();
          if (!submissionId || !(submissionId.match(/[0-9]+/))) {
            return callback({name: 'Can\'t load submission id.', retry: true});
          } else {
            return callback(null, submissionId);
          }
        };

        this._send = function(probNum, codeString, language, tryLogin, callback) {
          var langVal = cls.getLangVal(util.getLang(language));
          if (langVal < 0) {
              return callback(new Error('Linguagem desconhecida.'));
          }
          that.sendQueue.push({probNum: probNum, language: langVal, codeString: codeString}, callback);
        };

        this._internalSend = function(browser, probNum, codeString, language, tryLogin, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("file://" + SPOJBR_SUBMIT_PATH).then(subCallback);
            },
            function(subCallback) {
              browser
                .fill('input[name="problemcode"]', probNum)
                .select('select[name="lang"]', language)
                .fill('textarea', codeString)
                .pressButton('input[value="Send"]')
                .then(subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            if (err) {
                return callback(err);
            } else if (html.match(AUTH_REQUIRED_TEST_REGEX)) {
                if (tryLogin) {
                    return that._login(browser, function(err, logged) {
                        if (!logged) return callback(new Error('Can\'t login.'));
                        return that._internalSend(browser, probNum, codeString, language, false, callback);
                    });
                } else {
                    return callback(new Error('Can\'t submit.'));
                }
            } else if (html.match(WRONG_LANGUAGE_REGEX)) {
              return callback({name: 'Linguagem inválida para este problema.', retry: false});
            } else {
              return that._getSubmissionId(browser, html, callback);
            }
          });
        };

        this._getAvailableBrowser = function() {
          for (var i = 0; i < that.browsers.length; i++) {
            if (that.browsers[i]._available) {
              that.browsers[i]._available = false;
              return that.browsers[i];
            }
          }
          var browser = new Browser(options);
          that.browsers.push(browser);
          return browser;
        };

        this._releaseBrowser = function(browser) {
          browser._available = true;
        };

        this.sendQueue = async.queue(function (sub, callback) {
          var browser = that._getAvailableBrowser();
          that._internalSend(browser, sub.probNum, sub.codeString, sub.language, true, function(err, submissionId) {
            that._releaseBrowser(browser);
            return callback(err, submissionId);
          });
        }, WORKER_BROWSERS);

    }

    /**
     * @param lang One of LANG_* constants
     * @return SPOJBR lang value or -1 if unacceptable.
     */
    cls.getLangVal = function(lang){
        switch (lang) {
            case util.LANG_C: return '11';
            case util.LANG_JAVA: return '10';
            case util.LANG_CPP: return '41';
            case util.LANG_PASCAL: return '22';
            case util.LANG_CPP11: return '44';
        }
        return -1;
    };

    return cls;
})(Adapter);
