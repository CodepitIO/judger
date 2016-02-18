'use strict';

const path = require('path'),
      async = require('async'),
      Browser = require('zombie'),
      assert = require('chai').assert,
      cheerio = require('cheerio'),
      format = require('util').format,
      rest = require('restler'),
      request = require('request'),
      _ = require('underscore');

const util = require('../utils/util'),
      Adapter = require('../adapters/adapter'),
      RequestClient = require('../utils/requestClient'),
      Problem = require('../models/problem'),
      config = require('../config/defaults'),
      errors = require('../utils/errors');

const URI_HOST = "www.urionlinejudge.com.br",
      LOGIN_PAGE_PATH = "/judge/pt/login",
      SUBMIT_PAGE_PATH = "/judge/pt/runs/add",
      SUBMISSIONS_PAGE_PATH = "/judge/pt/runs",
      LAST_SUBMISSIONS_API = "/judge/maratonando/%s/runs/100";

// Options and global variables
const options = {
  runScripts: false,
  waitDuration: "15s"
};

const LOGIN_TEST_REGEX = /Perfil/i,
      SUBMITTED_REGEX = /fila\s+para\s+ser\s+julgada/i;

const OJ_NAME = "uri",
      CONFIG = config.oj[OJ_NAME],
      WORKER_BROWSERS = CONFIG.submissionWorkersPerAdapter || 1;

module.exports = (function(genAdapter) {
    // constructor
    function URIAdapter(account) {

      genAdapter.call(this, account);
      var browsers = [];
      var last = 0;
      var that = this;

      var _login = function(browser, callback) {
        async.waterfall([
          (subCallback) => {
            browser.visit("http://" + URI_HOST + LOGIN_PAGE_PATH, subCallback);
          },
          (subCallback) => {
            browser
              .fill('#email', account.getUser())
              .fill('#password', account.getPass())
              .check('#remember-me')
              .pressButton('input.send-green', subCallback);
          }
        ], (err) => {
          var html = browser.html() || '';
          return callback(null, !!html.match(LOGIN_TEST_REGEX));
        });
      }

      var _getSubmissionId = function(browser, callback) {
        var submissionsApi = format(LAST_SUBMISSIONS_API, CONFIG.accessKey);
        rest.get('http://' + URI_HOST + submissionsApi).on('complete', function(result) {
          if (result instanceof Error) return callback(result);
          var submission = _.find(result, function (x) { return x.UserID.toString() === account.getId() }) || {};
          var submissionId = submission.SubmissionID.toString();
          if (!submissionId || !submissionId.match(/[0-9]+/)) {
            return callback({name: 'Falha de submissão', retry: true});
          } else {
            return callback(null, submissionId);
          }
        });
      };

      var _internalSend = function(browser, probNum, codeString, language, tryLogin, callback) {
        async.waterfall([
          (subCallback) => {
            browser.visit("http://" + URI_HOST + SUBMIT_PAGE_PATH).then(subCallback);
          },
          (subCallback) => {
            browser
              .fill('#problem-id', probNum)
              .select('#language-id', language)
              .fill('#source-code', codeString)
              .pressButton('input.send-green', subCallback);
          }
        ], (err) => {
          var html = browser.html() || '';
          if (err) {
              return callback(err);
          } else if (browser.location.pathname === LOGIN_PAGE_PATH) {
              if (tryLogin) {
                  return _login(browser, function(err, logged) {
                      if (!logged) return callback({name: 'Não consegue logar.', retry: true});
                      return _internalSend(browser, probNum, codeString, language, false, callback);
                  });
              } else {
                  return callback({name: 'Não consegue submeter.', retry: true});
              }
          } else if (html.match(SUBMITTED_REGEX)) {
            return _getSubmissionId(browser, callback);
          } else {
            return callback({name: 'Submissão inválida.', retry: false});
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

      var sendQueue = async.queue((sub, callback) => {
        var browser = _getAvailableBrowser();
        _internalSend(browser, sub.probNum, sub.codeString, sub.language, true, (err, submissionId) => {
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
        var submissionsApi = format(LAST_SUBMISSIONS_API, CONFIG.accessKey);
        rest.get('http://' + URI_HOST + submissionsApi).on('complete', function(result) {
          if (result instanceof Error) return callback(result);
          var verdict = {};
          for (var i = 0; i < result.length; i++) {
            verdict[result[i].SubmissionID] = result[i].Verdict;
          }
          for (var id in submissions) {
            that.events.emit('verdict', id, verdict[id] || 'Submission error');
          }
          return callback();
        });
      };
    }

    return URIAdapter;
})(Adapter);
