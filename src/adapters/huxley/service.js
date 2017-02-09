'use strict';

const fs        = require('fs'),
      async     = require('async'),
      path      = require('path'),
      util      = require('util'),
      _         = require('lodash')

const Adapter       = require('../adapter'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Defaults      = require('../../config/defaults'),
      Config        = require('./config')

const HOST              = 'www.thehuxley.com',
      AUTH_PATH         = '/api/login',
      SUBMIT_PATH       = '/api/v1/user/problems/%s/submissions',
      SUBMISSIONS_PATH  = '/api/v1/submissions?max=20';

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
      INPUT_PATTERN       = /<input([^>]+?)\/?>/gi;

const TYPE = path.basename(__dirname);

module.exports = (function(parentCls){

    function AdapterHUXLEY(acct) {
        parentCls.call(this, acct);
        if (!fs.existsSync('/tmp')) {
          fs.mkdirSync('/tmp')
        }

        const client = new RequestClient('https', HOST);

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
          let fileName = "Main" + Defaults.extensions[langName];
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

    // Problems Fetcher
    (function(obj) {
      const PROBLEMS_PATH_UNF = "/api/v1/problems?max=%s&offset=%s";
      const client = new RequestClient('https', HOST);
      const maxPerPage = 100;

      const PROBLEM_PATH_UNF = "/api/v1/problems/%s";
      const EXAMPLES_PATH_UNF = "/api/v1/problems/%s/examples?max=10";

      const tmplPath = './src/adapters/huxley/problem_template.html';
      const tmpl = _.template(fs.readFileSync(tmplPath, 'utf8'));

      obj.import = (problem, callback) => {
        let problemPath = util.format(PROBLEM_PATH_UNF, problem.id);
        let examplesPath = util.format(EXAMPLES_PATH_UNF, problem.id);
        async.parallel({
          meta: (next) => {
            return client.get(problemPath, {json: true}, next);
          },
          tests: (next) => {
            return client.get(examplesPath, {json: true}, next);
          }
        }, (err, results) => {
          if (err) return callback(err);
          let data = {};
          try {
            let meta = results.meta[1];
            let tests = results.tests[1];
            if (meta.status === '404') {
              return callback(Errors.ResourceNotFound);
            }
            _.map(tests, (obj) => {
              obj.input = obj.input || '';
              obj.input = obj.input.replace(/\r?\n/g, '<br>');
              obj.output = obj.output || '';
              obj.output = obj.output.replace(/\r?\n/g, '<br>');
              return obj;
            });
            data.timelimit = meta.timeLimit;
            if (meta.source) data.source = 'Fonte: ' + meta.source;

            meta.description = meta.description || '';
            meta.description = meta.description.replace(/<=/g, '&lt;=');
            meta.inputFormat = meta.inputFormat || '';
            meta.inputFormat = meta.inputFormat.replace(/<=/g, '&lt;=');
            meta.outputFormat = meta.outputFormat || '';
            meta.outputFormat = meta.outputFormat.replace(/<=/g, '&lt;=');
            data.html = tmpl({
              description: meta.description,
              inputFormat: meta.inputFormat,
              outputFormat: meta.outputFormat,
              tests: tests
            });
          } catch (err) {
            return callback(err);
          }
          return callback(null, data);
        });
      }

      function processProblems(problemsPath, problems, callback) {
        client.get(problemsPath, (err, res, data) => {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return callback(e);
          }
          for (let i = 0; i < data.length; i++) {
            problems.push({
              id: data[i].id + '',
              name: data[i].name,
              oj: TYPE
            });
          }
          if (data.length !== maxPerPage) {
            return callback(Errors.ResourceNotFound);
          }
          return callback(null);
        });
      }

      obj.fetchProblems = (callback) => {
        let problems = [];
        let idx = 0;
        async.forever(
          (next) => {
            idx = idx + 1;
            let problemsPath = util.format(PROBLEMS_PATH_UNF, maxPerPage, (idx-1) * maxPerPage);
            return processProblems(problemsPath, problems, next);
          },
          (err) => {
            return callback(null, problems);
          }
        );
      }
    })(AdapterHUXLEY)

    return AdapterHUXLEY;
})(Adapter);
