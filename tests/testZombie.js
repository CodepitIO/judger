var path = require('path');
var async = require('async');
var Browser = require('zombie');
var cheerio = require('cheerio');
var Judger = require('../config/defaults').Judger;

var SPOJ_LOGIN_PATH = path.join(__dirname, "resources", "spoj_login.html");
var SPOJ_SUBMIT_PATH = path.join(__dirname, "resources", "spoj_submit.html");

// Options and global variables
options = {
  runScripts: false,
  loadCSS: false,
  loadCSS: false,
  silent: true,
  maxWait: "30s"
};

var LOGIN_TEST_REGEX = /total\s+submissions/i;
var AUTH_REQUIRED_TEST_REGEX = /authori[sz]ation\s+required/i;
var oj_name = "spoj";
var oj = Judger[oj_name];

var browsers = [];

var _login = function(browser, callback) {
  try {
    async.waterfall([
      function(subCallback) {
        browser.visit("file://" + SPOJ_LOGIN_PATH, options).then(subCallback);
      },
      function(subCallback) {
        browser
          .fill('login_user', oj.username)
          .fill('password', oj.password)
          .check('autologin')
          .pressButton('submit')
          .then(subCallback)
          .catch(subCallback);
      }
    ], function(err) {
      var html = browser.html() || '';
      return callback(null, !!html.match(LOGIN_TEST_REGEX));
    });
  } catch(err) {
    var html = browser.html() || '';
    return callback(null, !!html.match(LOGIN_TEST_REGEX));
  }
}

var _getSubmissionId = function(browser, html, callback) {
  try {
    var $ = cheerio.load(html);
    var submissionId = $('input[name="newSubmissionId"]').val();
    if (!submissionId || !submissionId.match(/[0-9]+/)) {
      throw new Error('Can\'t load submission id.');
    } else {
      return callback(null, submissionId);
    }
  } catch (err) {
    return callback(err);
  }
}

var _send = function(browser, probNum, codeString, language, tryLogin, callback) {
  try {
    async.waterfall([
      function(subCallback) {
        browser.visit("file://" + SPOJ_SUBMIT_PATH, options).then(subCallback);
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
              return _login(browser, function(err, logged) {
                  if (!logged) return callback(new Error('Can\'t login.'));
                  return _send(browser, probNum, codeString, language, false, callback);
              });
          } else {
              return callback(new Error('Can\'t submit.'));
          }
      } else {
        return _getSubmissionId(browser, html, callback);
      }
    });
  } catch(err) {
    return callback(err);
  }
}

var _getAvailableBrowser = function() {
  for (var i = 0; i < browsers.length; i++) {
    if (browsers[i]._available) {
      browsers[i]._available = false;
      return browsers[i];
    }
  }
  var browser = new Browser(options);
  browsers.push(browser);
  return browser;
}

var _releaseBrowser = function(browser) {
  browser._available = true;
}


var sendQueue = async.queue(function (sub, callback) {
  var browser = _getAvailableBrowser();
  console.log(browsers.length);
  try {
    _send(browser, sub.probNum, sub.codeString, sub.language, true, function(err, submissionId) {
      _releaseBrowser(browser);
      return callback(err, submissionId);
    });
  } catch (err) {
    _releaseBrowser(browser);
    return callback(err);
  }
}, 3);

/* testing */
var fs = require('fs'),
    readline = require('readline');

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rd.on('line', function(line) {
  sendQueue.push({probNum: "TEST", language: '41', codeString: line}, function(err, submissionId) {
    console.log(submissionId);    
  });
    /*if (line == 'send') {

    } else if (line == 'login') {
    }*/
});
