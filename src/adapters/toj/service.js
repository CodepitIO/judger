'use strict';

const async   = require('async'),
      assert  = require('assert'),
      path    = require('path'),
      cheerio = require('cheerio'),
      util    = require('util'),
      iconv   = require('iconv-lite'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils         = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const SUBMIT_PATH       = "/toj/submit_process.php",
      SUBMISSIONS_PATH  = "/toj/status.php?user=%s";

const SUBMITTED_PATTERN  = /source\s+code\s+has\s+been\s+submitted/i,
      SUBMISSION_PATTERN = /<tr\s+align=center\s+height=\d+><td>(\d+)<\/td>/,
      PROBLEMS_PATTERN   = /p\(\d+,\d+,(\d+),"([^"]+)",.+\)/ig;

module.exports = ((parentCls) => {

  function AdapterTOJ(acct) {
    parentCls.call(this, acct);

    let client = new RequestClient(Config.url);

    function login(callback) {
      return callback();
    };

    this._login = login;

    function getSubmissionId(callback) {
      let submissionsPath = util.format(SUBMISSIONS_PATH, acct.getUser());
      client.get(submissionsPath, (err, res, html) => {
        if (err) {
          return callback(err);
        }
        html = html || '';
        let id;
        try {
          id = html.match(SUBMISSION_PATTERN)[1];
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(e);
        }
        return callback(null, id);
      })
    };

    function send(submission, retry, callback) {
      let data = {
        user_id: acct.getUser(),
        passwd: acct.getPass(),
        prob_id: submission.problemId,
        language: submission.language,
        source: submission.code,
      };
      client.post(SUBMIT_PATH, data, {}, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        if (!html.match(SUBMITTED_PATTERN)) {
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
      client.get(util.format(SUBMISSIONS_PATH, acct.getUser()), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = _.trim(data.nextAll().eq(1).text());
            judgeSet[id].verdict = data;
          } catch(e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterTOJ;
})(Adapter);
