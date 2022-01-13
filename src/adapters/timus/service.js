"use strict";

const cheerio = require("cheerio"),
  assert = require("assert"),
  async = require("async"),
  path = require("path"),
  util = require("util"),
  Browser = require("zombie");

const Adapter = require("../adapter"),
  Errors = require("../../../common/errors"),
  RequestClient = require("../../../common/lib/requestClient"),
  Utils = require("../../../common/lib/utils");

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const SUBMIT_PAGE_PATH = "/submit.aspx",
  STATUS_PATH = "/status.aspx",
  AUTHOR_UNF_PATH = "/status.aspx?space=1&count=50&author=%s";

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
  INPUT_PATTERN = /<input([^>]+?)\/?>/gi,
  INVALID_ACC_PATTERN = /Invalid\s+JUDGE_ID/i,
  FAST_SUB_PATTERN = /between\s+submissions/i;

module.exports = (function (parentCls) {
  function AdapterTIMUS(acct) {
    parentCls.call(this, acct);

    const browser = new Browser({ runScripts: false, strictSSL: false });
    const client = new RequestClient(Config.url);

    const AUTHOR_PATH = util.format(AUTHOR_UNF_PATH, acct.getUser());

    function login(callback) {
      return callback();
    }

    this._login = login;

    function getSubmissionID(callback) {
      client.get(AUTHOR_PATH, (err, res, html) => {
        if (err) {
          return callback(err);
        }
        let id;
        try {
          let $ = cheerio.load(html);
          id = $(".id a").html();
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });
    }

    function send(submission, callback) {
      async.waterfall(
        [
          (next) => {
            browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
          },
          (next) => {
            try {
              browser.fill("input[name='JudgeID']", acct.getPass());
              browser.fill("input[name='ProblemNum']", submission.problemId);
              browser.fill("textarea[name='Source']", submission.code);
              browser.select("select[name='Language']", submission.language);
              browser.pressButton("input[value='Submit']", next);
            } catch (err) {
              return next(err);
            }
          },
        ],
        (err) => {
          let html = browser.html() || "";
          if (err) {
            return callback(err);
          }
          if (html.match(INVALID_ACC_PATTERN)) {
            return callback(Errors.LoginFail);
          }
          console.log(browser.location.pathname, STATUS_PATH);
          if (
            html.match(FAST_SUB_PATTERN) ||
            browser.location.pathname !== STATUS_PATH
          ) {
            return callback(Errors.SubmissionFail);
          }
          console.log("Aqui!");
          return getSubmissionID(callback);
        }
      );
    }

    this._send = send;

    function judge(judgeSet, callback) {
      client.get(AUTHOR_PATH, (err, res, html) => {
        if (err) {
          return callback();
        }
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('a:contains("' + id + '")');
            data = data.parent().nextAll().eq(4);
            if (!data.find("a").html()) {
              data = data.html();
            } else {
              data = data.find("a").html();
            }
            judgeSet[id].verdict = data;
          } catch (e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterTIMUS;
})(Adapter);
