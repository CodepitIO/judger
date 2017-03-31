'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util');

const HOST              = "www.codechef.com",
      SUBMIT_PATH       = "/submit/%s",
      LIMIT_CON_PATH    = "/session/limit";

const LOGGED_PATTERN          = /edit\s+profile/i,
      LOGIN_FORM_PATTERN      = /<form([^>]+?id\s*=\s*["']?\w*new-login-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SUBMIT_FORM_PATTERN      = /<form([^>]+?id\s*=\s*["']?\w*problem-submission[^>]*)>((?:.|\r|\n)*?)<\/form>/i;

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterCODECHEF(acct) {
    parentCls.call(this, acct);

    const client = new RequestClient('https', HOST);

    function login(callback) {
      async.waterfall([
        (next) => {
          client.get('/', next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(LOGIN_FORM_PATTERN, html);
            f.data['name'] = acct.getUser();
            f.data['pass'] = acct.getPass();
            opts = {
              followAllRedirects: true,
              headers: { Referer: 'https://' + HOST, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(f.action, f.data, opts, next);
        }
      ], (err, res, html) => {
        html = html || '';
        require('fs').writeFileSync('foo.html', html, 'utf8');
        if (html.match(LIMIT_CON_PATTERN)) {
          console.log(res.req.path);
          return logout(callback);
        }
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    function logout(callback) {
      // console.log(client.request);
    }

    this._login = login;

    function send(submission, retry, callback) {
      console.log('oi');
      async.waterfall([
        (next) => {
          client.get(util.format(SUBMIT_PATH, submission.problemId), next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(SUBMIT_FORM_PATTERN, html);
            console.log(f);
            if (!f) return next(Errors.SubmissionFail);
            opts = {
              followAllRedirects: true,
              headers: { Referer: 'https://' + HOST, },
            };
            f.data.program = submission.code;
            f.data.filename = '';
            f.data.language = submission.language;
          } catch (e) {
            console.log(e);
            return next(Errors.SubmissionFail);
          }
          console.log(f);
          return client.post(f.action, f.data, opts, next);
        }
      ], (err, a, b, c) => {
        if (err) {
          if (!retry) return callback(err);
          return login((err) => {
            if (err) return callback(err);
            return send(submission, false, callback);
          });
        }
        console.log(err);
        require('fs').writeFileSync('stor.html', b);
      });
/*      let data = {
        localid: submission.problemId,
        code: submission.code,
        language: submission.language,
        codeupl: '',
        problemid: '',
        category: '',
      };
      let opts = {
        headers: {
          Referer: 'https://' + HOST + SUBMIT_PAGE_PATH,
        },
      };
      client.postMultipart(SUBMIT_PATH, data, opts, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        if (html.match(NOT_AUTHORIZED_PATTERN)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {

          }
        }
        let id;
        try {
          id = /([0-9]{6,15})/.exec(res.req.path)[0];
          assert(id && id.length >= 6);
        } catch (err) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });*/
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      client.get(SUBMISSIONS_PATH, (err, res, html) => {
        html = html || '';
        if (!html.match(LOGGED_PATTERN)) {
          return login(callback);
        }
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = data.nextAll().eq(2);
            if (!data.find('a').html()) {
              data = data.html();
            } else {
              data = data.find('a').html();
            }
            judgeSet[id].verdict = data;
          } catch(e) {}
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  // Problems Fetcher
  (function(obj) {

  })(AdapterCODECHEF);

  return AdapterCODECHEF;
})(Adapter);
