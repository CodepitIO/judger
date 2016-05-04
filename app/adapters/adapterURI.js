'use strict';

const path    = require('path'),
      async   = require('async'),
      Browser = require('zombie'),
      util    = require('util'),
      cheerio = require('cheerio');

const Adapter       = require('../adapters/adapter'),
      RequestClient = require('../utils/requestClient'),
      Errors        = require('../utils/errors'),
      Defaults      = require('../config/defaults');

const HOST                  = "www.urionlinejudge.com.br",
      LOGIN_PAGE_PATH       = "/judge/pt/login",
      SUBMIT_PAGE_PATH      = "/judge/pt/runs/add",
      SUBMISSIONS_API_UNF   = "/judge/maratonando/%s/runs/%s";

const LOGIN_TEST_REGEX = /Perfil/i;

const TYPE = /^adapter(\w+)/i.exec(path.basename(__filename))[1].toLowerCase();

module.exports = (function(parentCls) {

  function AdapterURI(acct) {
    parentCls.call(this, acct);

    AdapterURI.accessKey = acct.getAccessKey();

    const browser = new Browser({runScripts: false, waitDuration: "15s"});
    const client = new RequestClient('https', HOST);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit("https://" + HOST + LOGIN_PAGE_PATH, next);
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
        if (err) return callback(err);
        for (let i = 0; i < data.length; i++) {
          if (data[i].UserID.toString() === acct.getId()) {
            return callback(null, data[i].SubmissionID.toString());
          }
        }
        return callback(Errors.SubmissionFail);
      });
    };

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit("http://" + HOST + SUBMIT_PAGE_PATH).then(next);
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
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

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
    };

    this._judge = judge;
  }

  // Problems Fetcher
  (function(obj) {
    const PROBLEMSET_API_UNF = "/judge/maratonando/%s/problems";

    const client = new RequestClient('https', HOST);

    obj.import = (problem, callback) => {
      let url = Defaults.oj[TYPE].getProblemPath(problem.id);
      client.get(url, (err, res, html) => {
        if (err) return callback(err);
        let content;
        try {
          let $ = cheerio.load(html);
          $('head').remove();
          $('div.header span').remove();
          $('div.header h1').remove();
          content = $.html();
        } catch (err) {
          return callback(err);
        }
        return callback(null, content);
      });
    }

    obj.fetchProblems = (callback) => {
      if (!AdapterURI.accessKey) {
        return callback();
      }
      let problems = [];
      let url = util.format(PROBLEMSET_API_UNF, AdapterURI.accessKey);
      async.waterfall([
        (next) => {
          client.get(url, {json: true}, next);
        },
        (res, data, next) => {
          try {
            for (let i = 0; i < data.length; i++) {
              if (data[i].ProblemID && data[i].Name) {
                problems.push({
                  id: data[i].ProblemID + '',
                  name: data[i].Name,
                  oj: TYPE
                });
              }
            }
            return next(null, problems);
          } catch (err) {
            return next(err);
          }
        }
      ], callback);
    }
  })(AdapterURI);

  return AdapterURI;
})(Adapter);
