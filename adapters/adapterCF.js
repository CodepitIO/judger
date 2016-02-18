const path = require('path'),
      async = require('async'),
      Browser = require('zombie'),
      assert = require('chai').assert,
      cheerio = require('cheerio'),
      format = require('util').format,
      rest = require('restler'),
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
      STATUS_PATH = "/problemset/status",
      SUBMISSIONS_PATH = "/problemset/status?friends=on",
      SUBMISSIONS_API = "/api/user.status?handle=%s&count=30",
      PROBLEMSET_API = "/api/problemset.problems";

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

        // TODO: change request to restler
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

    var contentFetchQueue = async.queue(function(problem, callback) {
      var contestId = problem.contestId;
      var index = problem.index;
      request('http://' + CF_HOST + `/contest/${contestId}/problem/${index}`,
        function(err, response, body) {
          var error = err, content = null;
          if (!error) {
            try {
              var $ = cheerio.load(body);
              content = $('div.problemindexholder');
              var title = content.find('.header > .title').html();
              title = title.slice(3);
              content.find('.header > .title').html(title);
            } catch (err) {
              error = err;
            }
          }
          return callback(error, content.html());
        });
    }, 10);

    cls.importProblemContentIfNeeded = function(problem, contestId, index, callback) {
      if (problem.imported) {
	  return callback();
      }

      async.retry({times: 3, interval: 2000},
        contentFetchQueue.push.bind(null, {contestId: contestId, index: index}),
        function(err, content) {
          if (err) {
            // TODO: log to winston
            console.log('Error importing problem ' + problem._id);
            return callback();
          } else {
            Problem.saveProblemContent(problem._id, content, function(err) {
              if (err) console.log(err);
              problem.imported = true;
              problem.save(callback);
            });
          }
        }
      );
    }

    // TODO: stop as soon as we see a contest already inserted
    cls.fetchProblems = function(callback) {
      rest.get('http://' + CF_HOST + PROBLEMSET_API).on('complete', function(result) {
        if (result instanceof Error || result.status !== 'OK') {
          return callback(result, 0);
        } else {
          result = result.result && result.result.problems || [];
          async.forEachOf(result, function(obj, _, cb) {
            var id = obj.contestId + obj.index;
            var name = obj.name;
            return Problem.createNew(id, name, OJ_NAME, function(err, problem) {
              if (!err && problem) {
                return cls.importProblemContentIfNeeded(problem, obj.contestId, obj.index, cb);
              }
              return cb();
            });
          }, callback);
        }
      });
    }

    /*cls.fetchProblems(function() {
      console.log("Finished loading codeforces problems");
    });//*/

    return cls;
})(Adapter);
