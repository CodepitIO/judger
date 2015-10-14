const path = require('path'),
      async = require('async'),
      Browser = require('zombie'),
      assert = require('chai').assert,
      cheerio = require('cheerio'),
      format = require('util').format,
      request = require('request');

const util = require('../utils/util'),
      Adapter = require('../adapters/adapter'),
      RequestClient = require('../utils/requestClient'),
      Problem = require('../models/problem'),
      config = require('../config/defaults'),
      errors = require('../utils/errors');

const CF_HOST = "codeforces.com",
      LOGIN_PAGE_PATH = "/enter",
      SUBMIT_PAGE_PATH = "/problemset/submit",
      PROBLEMSET_PATH = "/problemset/page",
      STATUS_PATH = "/problemset/status",
      SUBMISSIONS_PATH = "/problemset/status?friends=on",
      SUBMISSIONS_API = "/api/user.status?handle=%s&count=30";

// Options and global variables
const options = {
  runScripts: false,
  waitDuration: "15s"
};

const LOGIN_TEST_REGEX = /logout/i,
      AUTH_REQUIRED_TEST_REGEX = /authori[sz]ation\s+required/i,
      LLD_REGEX = /preferred\s+to\s+use\s+cin/i;

const OJ_NAME = "cf",
      CONFIG = config.oj[OJ_NAME],
      WORKER_BROWSERS = CONFIG.submissionWorkersPerAdapter || 1;

module.exports = (function(parentCls) {
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        var browsers = [];
        var last = 0;
        var that = this;

        var _login = function(browser, callback) {
          async.waterfall([
            function(subCallback) {
              browser.visit("http://" + CF_HOST + LOGIN_PAGE_PATH, subCallback)
            },
            function(subCallback) {
              browser
                .fill('#handle', acct.getUser())
                .fill('#password', acct.getPass())
                .check('#remember')
                .pressButton('input[value="Login"]', subCallback);
            }
          ], function(err) {
            var html = browser.html() || '';
            return callback(null, !!html.match(LOGIN_TEST_REGEX));
          });
        };

        var _getSubmissionId = function(browser, callback) {
          browser.visit("http://" + CF_HOST + SUBMISSIONS_PATH).then(
            function() {
              var $ = cheerio.load(browser.html());
              var line = 0;
              var id = null;
              try {
                var row = $("table.status-frame-datatable tr").eq(1);
                var id = $(row).attr('data-submission-id');
                assert(id && id.length >= 6, 'submission id is valid');
              } catch (e) {
                return callback(errors.SubmissionFail);
              }
              return callback(null, id);
            }
          ).catch(callback);
        };

        var _internalSend = function(browser, probNum, codeString, language, tryLogin, callback) {

          var _afterSubmission = function(retry, err) {
            var html = browser.html() || '';
            if (err && !retry) {
                return callback(err);
            } else if (browser.location.pathname === '/') {
              if (!tryLogin) {
                return callback(errors.LoginFail);
              } else {
                return _login(browser, function(err, logged) {
                  if (!logged) return callback(errors.LoginFail);
                  return _internalSend(browser, probNum, codeString, language, false, callback);
                });
              }
            } else if (retry && html.match(LLD_REGEX)) {
              browser
                .check('input[name="doNotShowWarningAgain"]')
                .pressButton('input[value="Submit"]', _afterSubmission.bind(null, false));
            } else if (html.length && browser.location.pathname !== STATUS_PATH) {
              return callback(errors.InvalidSubmission);
            } else {
              return _getSubmissionId(browser, callback);
            }
          }

          async.waterfall([
            function(subCallback) {
              browser.visit("http://" + CF_HOST + SUBMIT_PAGE_PATH, subCallback)
            },
            function(subCallback) {
              browser
                .fill('input[name="submittedProblemCode"]', probNum)
                .select('select[name="programTypeId"]', language)
                .fill('#sourceCodeTextarea', codeString)
                .pressButton('input[value="Submit"]', subCallback);
            }
          ], _afterSubmission.bind(null, true));
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

        this._send = function(probNum, codeString, language, tryLogin, callback) {
          codeString = codeString + '\n// ' + (new Date()).getTime();
          var langVal = CONFIG.submitLang[language];
          if (!langVal) return callback(errors.InvalidLanguage);
          sendQueue.push({probNum: probNum, language: langVal, codeString: codeString}, callback);
        };

        this._judge = function(submissions, callback) {
          var url = format('http://' + CF_HOST + SUBMISSIONS_API, acct.getUser());
          request({
            url: url,
            json: true
          }, function(error, response, data) {
            if (error || response.statusCode !== 200 || data.status !== 'OK') {
              return callback();
            }
            data = data.result;
            for (var i = 0; i < data.length; i++) {
              var id = data[i].id;
              if (submissions[id]) {
                that.events.emit('verdict', id, data[i].verdict);
              }
            }
            return callback();
          });
        }

    }

    cls.fetchProblems = function() {
      var client = new RequestClient('http', CF_HOST + PROBLEMSET_PATH);

      var iterate = function(i, cb) {
        client.get('/' + i, function(err, res, html) {
          var $ = cheerio.load(html);
          var table = $('table.problems').children('tr:not(:first-child)');
          async.each(table, function(row, cb) {
            try {
              var tds = $(row).children();
              var id = tds.first().children(":first-child").html();
              var name = tds.first().next().children(":first-child").children(":first-child").html();
              id = /([0-9a-zA-Z].*)/.exec(id)[0];
              name = /([0-9a-zA-Z].*)/.exec(name)[0];
            } catch(e) {
              return cb(e);
            }
            var url = CONFIG.getUrl(id).replace('http://', '');
            var req = new RequestClient('http', url);
            req.get('/', function(err, res, html) {
              if (!html) return cb();
              var $ = cheerio.load(html);
              var page = '<link rel="stylesheet" href="http://st.codeforces.com/css/ttypography.css" type="text/css" charset="utf-8">';
              page += '<link rel="stylesheet" href="http://st.codeforces.com/css/problem-statement.css" type="text/css" charset="utf-8">';
              var content = $('div.problemindexholder');
              var title = content.find('.header > .title').html();
              if (!title) return cb();
              title = title.slice(3);
              content.find('.header > .title').html(title);
              page += content;
              req = null;
              return Problem.createNew(id, name, OJ_NAME, cb, page);
            });
          }, function(err) {
            if (i < 1) return cb(err);
            return setImmediate(iterate.bind(null, i-1, cb));
          });
        });
      }

      iterate(5, function(err) {
        console.log('Finished loading up problems from ' + CONFIG.name);
      });
    }
//    cls.fetchProblems();

    return cls;
})(Adapter);
