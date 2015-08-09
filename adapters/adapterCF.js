const path = require('path');
const async = require('async');
const Browser = require('zombie');
const cheerio = require('cheerio');

const util = require('../utils/util');
const Adapter = require('../adapters/adapter');

const CF_HOST = "codeforces.com";
const LOGIN_PAGE_PATH = "/enter";
const SUBMIT_PAGE_PATH = "/problemset/submit";

// Options and global variables
const options = {
  runScripts: false,
  loadCSS: false,
  maxWait: "30s"
};

const LOGIN_TEST_REGEX = /logout/i;
const AUTH_REQUIRED_TEST_REGEX = /authori[sz]ation\s+required/i;
const WRONG_LANGUAGE_REGEX = /submit\s+in\s+this\s+language/i;

const WORKER_BROWSERS = 1;

module.exports = (function(parentCls) {
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        this.browsers = [];
        this.last = 0;
        var that = this;

        this._login = function(browser, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("http://" + CF_HOST + LOGIN_PAGE_PATH).then(subCallback);
            },
            function(subCallback) {
              browser
                .fill('#handle', acct.user())
                .fill('#password', acct.pass())
                .check('#remember')
                .pressButton('input[value="Login"]')
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
          var line = 0;
          var submissionId = -1;
          $("table.status-frame-datatable tr").each(function() {
            if (line > 0) {
                var user = $(this).children().first().next().next();
                user = user.children().first().text();
                var _submissionId = $(this).attr('data-submission-id');
                if (user === acct.user() && _submissionId && _submissionId.match(/[0-9]+/) && submissionId != that.last) {
                    submissionId = _submissionId;
                    return false;
                }
            }
            line++;
            if (line > 4) return false;
          });
          if (submissionId == -1) {
            return callback({name: 'Can\'t load submission id.', retry: true});
          } else {
            that.last = submissionId;
            return callback(null, submissionId);
          }
        };

        this._send = function(probNum, codeString, language, tryLogin, callback) {
          codeString = codeString + '\n// ' + (new Date()).getTime();
          var langVal = cls.getLangVal(util.getLang(language));
          if (langVal < 0) {
              return callback(new Error('Linguagem desconhecida.'));
          }
          that.sendQueue.push({probNum: probNum, language: langVal, codeString: codeString}, callback);
        };

        this._internalSend = function(browser, probNum, codeString, language, tryLogin, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("http://" + CF_HOST + SUBMIT_PAGE_PATH).then(subCallback);
            },
            function(subCallback) {
              try {
                browser
                  .fill('input[name="submittedProblemCode"]', probNum)
                  .select('select[name="programTypeId"]', language)
                  .fill('#sourceCodeTextarea', codeString)
                  .pressButton('input[value="Submit"]')
                  .then(subCallback);
              } catch (err) {
                subCallback(null);
              }
            }
          ], function(err) {
            var html = browser.html() || '';
            if (err) {
                return callback(err);
            } else if (browser.location.pathname === '/') {
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
              if (browser.location.pathname == SUBMIT_PAGE_PATH) {
                return callback({name: 'Submissão inválida. Veja se você não está utilizando %lld ao invés de %I64d, por exemplo (necessário para submissões no Codeforces).', retry: false});
              }
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
     * @return SPOJ lang value or -1 if unacceptable.
     */
    cls.getLangVal = function(lang){
        switch (lang) {
            case util.LANG_C: return '10';
            case util.LANG_JAVA: return '36';
            case util.LANG_CPP: return '1';
            case util.LANG_PASCAL: return '4';
            case util.LANG_CPP11: return '42';
        }
        return -1;
    };

    return cls;
})(Adapter);
