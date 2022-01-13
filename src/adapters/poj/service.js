"use strict";

const async = require("async"),
  assert = require("assert"),
  path = require("path"),
  cheerio = require("cheerio"),
  util = require("util"),
  iconv = require("iconv-lite"),
  _ = require("lodash");

const Adapter = require("../adapter"),
  Errors = require("../../../common/errors"),
  RequestClient = require("../../../common/lib/requestClient"),
  Utils = require("../../../common/lib/utils");

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PATH = "/login",
  SUBMIT_PATH = "/submit",
  SUBMISSIONS_PATH = "/status?user_id=%s";

const LOGGED_PATTERN = /Log\s+Out/i,
  LOGIN_FORM_PATTERN =
    /<form([^>]+?action\s*=\s*["']?\w*login[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
  NOT_AUTHORIZED_PATTERN = /Please\s+login\s+first/i;

module.exports = ((parentCls) => {
  function AdapterPOJ(acct) {
    parentCls.call(this, acct);

    let client = new RequestClient(Config.url);

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
            return client.post(LOGIN_PATH, f.data, opts, next);
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

    function getSubmissionId(html, callback) {
      let id;
      try {
        let $ = cheerio.load(html);
        let elem = $("table.a tr:nth-child(2)");
        if (elem.find("td:nth-child(2) a").text() === acct.getUser()) {
          id = elem.find("td:first-child").text();
        }
        assert(id && id.length >= 6);
      } catch (e) {
        return callback(e);
      }
      return callback(null, id);
    }

    function send(submission, retry, callback) {
      let data = {
        problem_id: submission.problemId,
        source: new Buffer.from(submission.code).toString("base64"),
        language: submission.language,
        submit: "Submit",
        encoded: "1",
      };
      let opts = {
        headers: {
          Referer: Config.url + SUBMIT_PATH,
        },
      };
      client.post(SUBMIT_PATH, data, opts, (err, res, html) => {
        if (err) return callback(err);
        html = html || "";
        if (html.match(NOT_AUTHORIZED_PATTERN)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(html, callback);
      });
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      let submissionsPath = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissionsPath, (err, res, html) => {
        html = html || "";
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = _.trim(data.nextAll().eq(2).text());
            judgeSet[id].verdict = data;
          } catch (e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterPOJ;
})(Adapter);
