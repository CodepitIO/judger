const path = require('path');
const async = require('async');
const Browser = require('zombie');
const cheerio = require('cheerio');

const util = require('../utils/util');
const Adapter = require('../adapters/adapter');

const URI_HOST = "www.urionlinejudge.com.br";
const LOGIN_PAGE_PATH = "/judge/login";
const SUBMIT_PAGE_PATH = "/judge/pt/runs/add";
const SUBMISSIONS_PAGE_PATH = "/judge/pt/runs";

// Options and global variables
const options = {
  runScripts: false,
  waitDuration: "15s"
};

const LOGIN_TEST_REGEX = /seu\s+progresso/i;
const SUBMITTED_REGEX = /fila\s+para\s+ser\s+julgada/i;

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
              browser.visit("http://" + URI_HOST + LOGIN_PAGE_PATH).then(subCallback);
            },
            function(subCallback) {
              browser
                .fill('#UserEmail', acct.getUser())
                .fill('#UserPassword', acct.getPass())
                .pressButton('input.send-sign-in')
                .then(subCallback)
                .catch(subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            return callback(null, !!html.match(LOGIN_TEST_REGEX));
          });
        };

        this._getSubmissionId = function(browser, callback) {
          browser.visit("http://" + URI_HOST + SUBMISSIONS_PAGE_PATH).then(function() {
            try {
              $ = cheerio.load(browser.html());
              var submissionId = $('td.id').first().children().first().html();
              if (!submissionId || !(submissionId.match(/[0-9]+/))) {
                return callback({name: 'Falha de submissão', retry: true});
              } else {
                return callback(null, submissionId);
              }
            } catch (err) {

            }
          });
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
              browser.visit("http://" + URI_HOST + SUBMIT_PAGE_PATH).then(subCallback);
            },
            function(subCallback) {
              try {
                browser
                  .fill('#RunProblemId', probNum)
                  .select('#RunLanguageId', language)
                  .fill('#RunSourceCode', codeString)
                  .pressButton('input.send-submit')
                  .then(subCallback);
              } catch (err) {
                subCallback(null);
              }
            }
          ], function(err) {
            var html = browser.html() || '';
            if (err) {
                return callback(err);
            } else if (browser.location.pathname === LOGIN_PAGE_PATH) {
                if (tryLogin) {
                    return that._login(browser, function(err, logged) {
                        if (!logged) return callback({name: 'Não consegue logar.', retry: true});
                        return that._internalSend(browser, probNum, codeString, language, false, callback);
                    });
                } else {
                    return callback({name: 'Não consegue submeter.', retry: true});
                }
            } else if (html.match(SUBMITTED_REGEX)) {
              return that._getSubmissionId(browser, callback);
            } else {
              return callback({name: 'Submissão inválida.', retry: false});
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
            case util.LANG_C: return '1';
            case util.LANG_CPP: return '2';
            case util.LANG_CPP11: return '2';
            case util.LANG_JAVA: return '3';
        }
        return -1;
    };

    return cls;
})(Adapter);
