'use strict';

const path    = require('path'),
      async   = require('async'),
      Browser = require('zombie'),
      assert  = require('assert'),
      cheerio = require('cheerio'),
      util    = require('util'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils          = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PAGE_PATH         = "/enter",
      GROUP_SUBMIT_PAGE_PATH  = "/group/%s/contest/%s/submit",
      SUBMISSIONS_API         = "/group/%s/status?showUnofficial=on";

const LOGIN_TEST_REGEX      = /logout/i,
      LLD_REGEX             = /preferred\s+to\s+use\s+cin/i;

module.exports = (function(parentCls) {

  function AdapterCFGroups(acct) {
    parentCls.call(this, acct);

    let browser = new Browser({runScripts: true, strictSSL: false, waitDuration: 100000});
    let client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + LOGIN_PAGE_PATH, next)
        },
        (next) => {
          browser
            .fill('#handleOrEmail', acct.getUser())
            .fill('#password', acct.getPass())
            .check('#remember')
            .pressButton('input[value="Login"]', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!html.match(LOGIN_TEST_REGEX)) {
          return login(callback);
        }
        return callback(null);
      });
    };

    this._login = login;

    function getSubmissionId(groupId, callback) {
      let submissionsUrl = util.format(SUBMISSIONS_API, groupId);
      client.get(submissionsUrl, (err, res, html) => {
        let id;
        try {
          let $ = cheerio.load(html);
          id = _.trim(
            $(`td[data-participantid="${acct.getId()}"]`).first().prev().prev().text()
          );
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });
    };

    function send(submission, retry, callback) {
      let split = _.split(submission.problemId, '/');
      let groupId = split[0];
      let contestId = split[1];
      let problemId = split[2];
      let submitPagePath = util.format(GROUP_SUBMIT_PAGE_PATH, groupId, contestId);
      async.waterfall([
        (next) => {
          browser.visit(Config.url + submitPagePath, next);
        },
        (next) => {
          if (browser.location.pathname === LOGIN_PAGE_PATH) {
            return next(Errors.LoginFail);
          }
          browser
            .select('select[name="submittedProblemIndex"]', problemId)
            .select('select[name="programTypeId"]', submission.language)
            .fill('#sourceCodeTextarea', submission.code)
            .pressButton('input[value="Submit"]', next);
        },
        (next) => {
          let html = browser.html() || '';
          if (html.match(LLD_REGEX)) {
            return browser.check('input[name="doNotShowWarningAgain"]')
              .pressButton('input[value="Submit"]', next);
          }
          return next();
        }
      ], (err) => {
        if (err && !retry) {
          return callback(err);
        } else if (browser.html().match(/should\s+satisfy\s+regex/i)) {
          return callback(Errors.UnretriableError);
        } else if (!browser.location.pathname.match(/\/my$/)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            browser = new Browser({runScripts: false});
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(groupId, callback);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let groups = _.chain(judgeSet)
        .values()
        .groupBy((o) => {
          return _.split(o.submission.problem.sid, '/')[0];
        })
        .value();
      async.eachOf(groups, (gJudgeSet, groupId, next) => {
        let submissionsUrl = util.format(SUBMISSIONS_API, groupId);
        client.get(submissionsUrl, (err, res, html) => {
          let $ = cheerio.load(html);
          _.forEach(gJudgeSet, (o) => {
            try {
              let id = o.submission.oj_id;
              let verdict = $(`span[submissionid="${id}"]`).attr('submissionverdict');
              judgeSet[id].verdict = verdict;
            } catch (e) {}
          });
          return next();
        });
      }, callback);
    }

    this._judge = judge;
  }

  return AdapterCFGroups;
})(Adapter);
