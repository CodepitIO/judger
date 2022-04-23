"use strict";

const path = require("path"),
  async = require("async"),
  Browser = require("zombie"),
  cheerio = require("cheerio"),
  _ = require("lodash");

const Adapter = require("../adapter"),
  Errors = require("../../../common/errors"),
  RequestClient = require("../../../common/lib/requestClient"),
  Utils = require("../../../common/lib/utils");

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PAGE_PATH = "/judge/en/login",
  SUBMIT_PAGE_PATH = "/judge/en/runs/add",
  SUBMISSIONS_PATH = "/judge/en/runs";

const LOGIN_TEST_REGEX = /DASHBOARD/i;

module.exports = (function (parentCls) {
  function AdapterURI(acct) {
    parentCls.call(this, acct);

    AdapterURI.accessKey = acct.getAccessKey();

    const browser = new Browser({ runScripts: false, strictSSL: false });
    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall(
        [
          (next) => {
            browser.visit(Config.url + LOGIN_PAGE_PATH, next);
          },
          (next) => {
            require("fs").writeFileSync(Math.random() + "html", browser.html());
            browser
              .fill("#email", acct.getUser())
              .then(() => browser.fill("#password", acct.getPass()))
              .then(() => browser.check("#remember-me"))
              .then(() => browser.pressButton('input[value="Sign In"]', next));
          },
        ],
        (err) => {
          let html = browser.html() || "";
          if (!html.match(LOGIN_TEST_REGEX)) {
            return callback(Errors.LoginFail);
          }
          return callback();
        }
      );
    }

    this._login = login;

    function getSubmissionId(callback) {
      browser.visit(Config.url + SUBMISSIONS_PATH, (err) => {
        if (err) return callback(err);
        try {
          let $ = cheerio.load(browser.html());
          let subId = _.trim(
            $("#element tbody tr").first().children().eq(0).text()
          );
          return callback(null, subId);
        } catch (err) {
          return callback(err);
        }
      });
    }

    let i = 0;
    function send(submission, retry, callback) {
      async.waterfall(
        [
          (next) => {
            browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
          },
          (next) => {
            try {
              browser.fill("#problem-id", submission.problemId);
              browser.select("#language-id", submission.language);
              browser.fill("#source-code", submission.code);
              browser.pressButton("input[value='SUBMIT']", next);
            } catch (err) {
              return next(err);
            }
          },
        ],
        (err) => {
          if (err && !retry) {
            return callback(err);
          } else if (browser.location.pathname.match(LOGIN_PAGE_PATH)) {
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
        }
      );
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      browser.visit(Config.url + SUBMISSIONS_PATH, (err) => {
        if (err) {
          return callback(err);
        }
        if (!browser.location.pathname.match(SUBMISSIONS_PATH)) {
          return login(callback);
        }
        let $ = cheerio.load(browser.html());
        for (let id in judgeSet) {
          let verdict = $(`a[href$="${id}"]`)
            .parent()
            .nextAll()
            .eq(3)
            .children("a")
            .text();
          judgeSet[id].verdict = verdict;
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterURI;
})(Adapter);
