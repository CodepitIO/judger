"use strict";

const cheerio = require("cheerio"),
  assert = require("assert"),
  async = require("async"),
  path = require("path"),
  util = require("util"),
  iconv = require("iconv-lite"),
  _ = require("lodash");

const Adapter = require("../adapter"),
  Errors = require("../../../common/errors"),
  RequestClient = require("../../../common/lib/requestClient"),
  Utils = require("../../../common/lib/utils");

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PATH = "/login/email?",
  SUBMIT_PATH = "/submit",
  SUBMISSIONS_PATH = "/users/%s";

const LOGGED_PATTERN = /My\s+Profile/i,
  NOT_FOUND_PATTERN = /404:\s+Not\s+Found/i,
  OUT_OF_TOKENS_PATTERN =
    /out\s+of\s+submission\s+tokens.\s+your\s+next\s+token\s+will\s+regenerate\s+in\s+(\d+)/i,
  LOGIN_FORM_PATTERN =
    /<form([^>]+?action\s*=\s*["']?[^>]*login[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  SUBMIT_PROBLEM_PATTERN =
    /<form([^>]+?id\s*=\s*["']?[^>]*submit-solution-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  NOT_AUTHORIZED_PATTERN = /requires\s+you\s+to\s+be\s+logged/i;

module.exports = ((parentCls) => {
  function AdapterKATTIS(acct) {
    parentCls.call(this, acct);

    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall(
        [
          (next) => {
            client.get(LOGIN_PATH, next);
          },
          (res, html, next) => {
            let f, opts;
            try {
              f = Utils.parseForm(LOGIN_FORM_PATTERN, html);
              f.data[f.userField] = acct.getUser();
              f.data[f.passField] = acct.getPass();
              opts = {
                followAllRedirects: true,
                headers: { Referer: Config.url },
              };
            } catch (e) {
              return next(Errors.SubmissionFail, res, html);
            }
            return client.post(f.action, f.data, opts, next);
          },
        ],
        (err, res, html) => {
          html = html || "";
          if (!html.match(LOGGED_PATTERN)) {
            return callback(Errors.LoginFail);
          }
          return callback();
        }
      );
    }

    this._login = login;

    function getSubmissionID(html, callback) {
      let id;
      try {
        let $ = cheerio.load(html);
        id = $("td.submission_id a").html();
        assert(id && id.length >= 6);
      } catch (e) {
        return callback(Errors.SubmissionFail);
      }
      return callback(null, id);
    }

    function send(submission, retry, callback) {
      async.waterfall(
        [
          (next) => {
            client.get(SUBMIT_PATH, next);
          },
          (res, html, next) => {
            let f, opts;
            try {
              f = Utils.parseForm(SUBMIT_PROBLEM_PATTERN, html);
              f.data["problem"] = submission.problemId;
              f.data["sub_code"] = submission.code;
              f.data["language"] = submission.language;
              f.data["type"] = "editor";
              if (submission.language === "Java") {
                f.data["mainclass"] = "Main";
              }
              opts = {
                followAllRedirects: true,
                headers: { Referer: Config.url },
              };
            } catch (e) {
              return next(Errors.SubmissionFail, res, html);
            }
            return client.post(f.action, f.data, opts, next);
          },
        ],
        (err, res, html) => {
          html = html || "";
          if (err || html.match(NOT_AUTHORIZED_PATTERN)) {
            if (!retry) {
              return callback(Errors.SubmissionFail);
            } else {
              return login((err) => {
                if (err) return callback(err);
                return send(submission, false, callback);
              });
            }
          }
          let match;
          if ((match = html.match(OUT_OF_TOKENS_PATTERN))) {
            if (!retry) return callback(Errors.SubmissionFail);
            let secs = parseInt(match[1]) * 1000;
            return setTimeout(() => {
              return send(submission, false, callback);
            }, secs);
          }
          return getSubmissionID(html, callback);
        }
      );
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      let submissions_path = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissions_path, (err, res, html) => {
        html = html || "";
        if (!!html.match(NOT_FOUND_PATTERN)) {
          return login(callback);
        }
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td.submission_id:contains("' + id + '")');
            data = data.nextAll().eq(2).text();
            judgeSet[id].verdict = data;
          } catch (e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterKATTIS;
})(Adapter);
