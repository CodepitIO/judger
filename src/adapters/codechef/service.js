"use strict";

const cheerio = require("cheerio"),
  assert = require("assert"),
  async = require("async"),
  path = require("path"),
  util = require("util"),
  _ = require("lodash"),
  fs = require("fs"),
  Browser = require("zombie");

const Adapter = require("../adapter"),
  Errors = require("../../../common/errors"),
  RequestClient = require("../../../common/lib/requestClient"),
  Utils = require("../../../common/lib/utils");

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PATH = "/login",
  SUBMIT_PATH = "/submit/%s",
  SESSION_LIMIT = "/session/limit",
  SUBMISSIONS_PATH = "/status/%s,%s";

const LOGGED_PATTERN = /Logout/i,
  LIMIT_CON_PATTERN = /session\s+to\s+disconnect/i,
  LOGIN_FORM_PATTERN =
    /<form([^>]+?id\s*=\s*["']?\w*new-login-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  SUBMIT_FORM_PATTERN =
    /<form([^>]+?id\s*=\s*["']?\w*problem-submission[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  SESSION_LIMIT_FORM_PATTERN =
    /<form([^>]+?id\s*=\s*["']?\w*session-limit-page[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  VERDICT_PATTERN1 = /title="(\w+)[^"]*"/i,
  VERDICT_PATTERN2 = /src="([^"]*)"/i;

module.exports = ((parentCls) => {
  function AdapterCODECHEF(acct) {
    parentCls.call(this, acct);
    if (!fs.existsSync("/tmp")) {
      fs.mkdirSync("/tmp");
    }

    const client = new RequestClient(Config.url);
    let browser = new Browser({
      runScripts: false,
      strictSSL: false,
      waitDuration: 30000,
    });

    function login(callback) {
      async.waterfall(
        [
          (next) => {
            browser.visit(Config.url + LOGIN_PATH, next);
          },
          (next) => {
            try {
              browser
                .fill("#edit-name", acct.getUser())
                .then(() => browser.fill("#edit-pass", acct.getPass()))
                .then(() => browser.pressButton("input[value='Login']", next));
            } catch (err) {
              return callback(Errors.LoginFail);
            }
          },
        ],
        (err) => {
          let html = browser.html() || "";
          if (!html.match(LOGGED_PATTERN)) {
            return login(callback);
          }
          return callback(null);
        }
      );
    }

    this._login = login;

    function send(sub, retry, callback) {
      async.waterfall(
        [
          (next) => {
            browser.visit(
              Config.url + util.format(SUBMIT_PATH, sub.problemId),
              next
            );
          },
          (next) => {
            try {
              browser
                .fill("#edit-program", sub.code)
                .then(() => browser.select("#edit-language", sub.language))
                .then(() => browser.pressButton('input[value="Submit"]', next));
            } catch (err) {
              return next(err);
            }
          },
        ],
        (err) => {
          if (err && !retry) {
            return callback(err);
          }
          let id;
          try {
            id = /\/submit\/complete\/([0-9]{6,15})/.exec(
              browser.location.pathname
            )[1];
            assert(id && id.length >= 6);
          } catch (err) {
            if (!retry) {
              return callback(Errors.SubmissionFail);
            }
            return login((err) => {
              if (err) return callback(err);
              return send(sub, false, callback);
            });
          }
          return callback(null, id);
        }
      );
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      let submissionsByProblems = _.groupBy(judgeSet, "submission.problem.id");
      async.forEachOf(
        submissionsByProblems,
        (submissions, problemId, next) => {
          let userSubmissionsPath = util.format(
            SUBMISSIONS_PATH,
            problemId,
            acct.getUser()
          );
          client.get(userSubmissionsPath, (err, res, html) => {
            try {
              for (let i in submissions) {
                let $ = cheerio.load(html);
                let id = submissions[i].submission.oj_id;
                let verdict = $("td[title='" + id + "']")
                  .nextAll()
                  .eq(2)
                  .find("span")
                  .attr("title");
                judgeSet[id].verdict = verdict;
              }
            } catch (err) {}
            return next();
          });
        },
        callback
      );
    }

    this._judge = judge;
  }

  return AdapterCODECHEF;
})(Adapter);
