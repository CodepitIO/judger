'use strict';

const fs        = require('fs'),
      async     = require('async'),
      assert    = require('assert'),
      path      = require('path'),
      util      = require('util'),
      _         = require('lodash')

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils          = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const AUTH_PATH         = '/api/login',
      SUBMIT_PATH       = '/api/v1/user/problems/%s/submissions',
      SUBMISSIONS_PATH  = '/api/v1/submissions?max=20';

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
      INPUT_PATTERN       = /<input([^>]+?)\/?>/gi;

module.exports = (function(parentCls){

  function AdapterHUXLEY(acct) {
    parentCls.call(this, acct);
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp')
    }

    const client = new RequestClient(Config.url);

    let accessToken = null;

    function login(callback) {
      let data = {
        username: acct.getUser(),
        password: acct.getPass(),
      };
      let opts = {
        body: JSON.stringify(data),
        form: '',
      };
      client.post(AUTH_PATH, data, opts, (err, res, data) => {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return callback(e);
        }
        if (err || !data.access_token) {
          return callback(Errors.LoginFail);
        }
        accessToken = data.access_token;
        return callback();
      });
    };

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
          let submitUrl = util.format(SUBMIT_PATH, submission.problemId);
          let data = {
            language: submission.language,
            file: fs.createReadStream(filePath),
          };
          let opts = {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
          };
          client.postMultipart(submitUrl, data, opts, next);
        },
        (res, data, next) => {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return next(e);
          }
          id = data.id;
          return next();
        }
      ], (err) => {
        if (filePath) fs.unlink(filePath, () => { fs.rmdir(dirPath); });
        if (err || !id) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return callback(null, id);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let opts = {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
      };
      client.get(SUBMISSIONS_PATH, opts, (err, res, data) => {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return callback(e);
        }
        for (let i = 0; i < data.length; i++) {
          if (judgeSet[data[i].id]) {
            judgeSet[data[i].id].verdict = data[i].evaluation;
          }
        }
        return callback();
      });
    }

    this._judge = judge;
  }

  return AdapterHUXLEY;
})(Adapter);
