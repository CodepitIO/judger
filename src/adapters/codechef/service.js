'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      _       = require('lodash'),
      fs      = require('fs');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils          = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const SUBMIT_PATH       = "/submit/%s",
      SESSION_LIMIT     = "/session/limit",
      SUBMISSIONS_PATH  = "/submissions?handle=%s&language=%s";

const LOGGED_PATTERN              = /edit\s+profile/i,
      LIMIT_CON_PATTERN           = /session\s+to\s+disconnect/i,
      LOGIN_FORM_PATTERN          = /<form([^>]+?id\s*=\s*["']?\w*new-login-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SUBMIT_FORM_PATTERN         = /<form([^>]+?id\s*=\s*["']?\w*problem-submission[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SESSION_LIMIT_FORM_PATTERN  = /<form([^>]+?id\s*=\s*["']?\w*session-limit-page[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      VERDICT_PATTERN1            = /title="(\w+)[^"]*"/i,
      VERDICT_PATTERN2            = /src="([^"]*)"/i;

module.exports = ((parentCls) => {

  function AdapterCODECHEF(acct) {
    parentCls.call(this, acct);
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp');
    }

    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          client.get('/', next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Utils.parseForm(LOGIN_FORM_PATTERN, html);
            f.data['name'] = acct.getUser();
            f.data['pass'] = acct.getPass();
            opts = {
              followAllRedirects: true,
              headers: { Referer: Config.url, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(f.action, f.data, opts, next);
        }
      ], (err, res, html) => {
        html = html || '';
        if (!!html.match(LIMIT_CON_PATTERN)) {
          return handleSessionLimit(html, callback);
        }
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    }

    function handleSessionLimit(html, callback) {
      var i = 0;
      async.forever((next) => {
        i++;
        let $ = cheerio.load(html);
        let sid = $('#session-limit-page .form-checkboxes .form-item input:not(:contains("current"))').first().val();
        if (!sid) return callback();
        let f = Utils.parseForm(SESSION_LIMIT_FORM_PATTERN, html);
        if (!f) return callback(Errors.LoginFail);
        let opts = {
          followAllRedirects: true,
          headers: { Referer: Config.url, },
        };
        f.data[`sid[${sid}]`] = sid;
        client.post(SESSION_LIMIT, f.data, opts, (err, res, _html) => {
          html = _html;
          if (err || !html) return callback();
          return next();
        });
      }, (err) => {
        return callback(err);
      });
    }

    this._login = login;

    function send(submission, retry, callback) {
      let dirPath, filePath;
      let langName = _.findKey(Config.submitLang, (o) => {
        return o === submission.language;
      });
      let fileName = "Main" + Utils.getExtension(langName);
      let id;

      async.waterfall([
        (next) => {
          fs.mkdtemp(path.join('/tmp', TYPE), next);
        },
        (_dirPath, next) => {
          dirPath = _dirPath;
          filePath = path.join(dirPath, fileName);
          fs.writeFile(filePath, submission.code, next);
        },
        (next) => {
          client.get(util.format(SUBMIT_PATH, submission.problemId), next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Utils.parseForm(SUBMIT_FORM_PATTERN, html);
            opts = {
              followAllRedirects: true,
              headers: { Referer: Config.url },
            };
            f.data.program = '';
            f.data.language = submission.language;
            f.data['files[sourcefile]'] = fs.createReadStream(filePath);
            delete f.data.op;
          } catch (e) {
            return next(Errors.SubmissionFail);
          }
          return client.postMultipart(f.action, f.data, opts, next);
        }
      ], (err, res, html) => {
        if (err) {
          if (!retry) return callback(err);
          return login((err) => {
            if (err) return callback(err);
            return send(submission, false, callback);
          });
        }
        let id;
        try {
          id = /\/submit\/complete\/([0-9]{6,15})/.exec(res.req.path)[1];
          assert(id && id.length >= 6);
        } catch (err) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      let userSubmissionsPath = util.format(
          SUBMISSIONS_PATH,
          acct.getUser(),
          1000000000 + Math.floor(Math.random()*1000000000));
      client.get(userSubmissionsPath, (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = data.nextAll().eq(4).html();
            let verdict = data.match(VERDICT_PATTERN1);
            if (verdict) verdict = verdict[1];
            if (!verdict || verdict.length === 0) {
              verdict = data.match(VERDICT_PATTERN2)[1];
            }
            judgeSet[id].verdict = verdict;
          } catch (e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterCODECHEF;
})(Adapter);
