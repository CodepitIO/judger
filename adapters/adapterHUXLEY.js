'use strict';

const fs = require('fs'),
      async = require('async'),
      rest = require('restler'),
      temp = require('temp').track(),
      path = require('path');

const Adapter = require('../adapters/adapter'),
      config = require('../config/defaults'),
      Problem = require('../models/problem'),
      errors = require('../utils/errors');

const TIMUS_HOST = 'acm.timus.ru',
      SUBMIT_PAGE_PATH = '/submit.aspx',
      SUBMIT_PATH = '/submit.aspx?space=1',
      STATUS_PATH = '/status.aspx?space=1&count=50';

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
      INPUT_PATTERN = /<input([^>]+?)\/?>/gi;

const OJ_NAME = 'huxley',
      CONFIG = config.oj[OJ_NAME];

module.exports = (function(parentCls){
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        var folderDir = path.join('/tmp', '.' + OJ_NAME + '-' + acct.getUser());
        if (!fs.existsSync(folderDir)) {
            fs.mkdirSync(folderDir, { mode: '0777' });
        }

        var that = this;
        var token = null;

        this._login = function(callback) {
          rest.post('http://dev.thehuxley.com/api/oauth/token', {
            data: {
              client_id: 'ui',
              grant_type: 'password',
              scope: 'write',
              username: acct.getUser(),
              password: acct.getPass(),
            }
          }).on('complete', function(result) {
            if (result instanceof Error || !result.access_token) {
              return callback(result, false);
            } else {
              token = result.access_token;
              return callback(result, true);
            }
          });
        };

        this._login(function() {});

        var _send = function(probNum, codeString, language, tryLogin, callback) {
          var langVal = CONFIG.submitLang[language];
          if (!langVal) return callback(errors.InvalidLanguage);

          var submissionId = null;

          var fileName = "Main" + config.extensions[language];

          var fileDir = path.join(folderDir, fileName);

          async.waterfall([
            function(subCallback) {
              fs.writeFile(fileDir, codeString, subCallback);
            },
            function(subCallback) {
              var file = rest.file(fileDir, null, fs.statSync(fileDir).size, 'utf8', 'text/plain'); 
              rest.post(`http://dev.thehuxley.com/api/v1/user/problems/${probNum}/submissions`, {
                accessToken: token,
                multipart: true,
                data: {
                  language: langVal,
                  file: file
                },
              }).on('complete', function(result) {
                if (result instanceof Error) {
                  return subCallback(result);
                } else {
                  submissionId = result.id;
                  fs.unlink(fileDir, subCallback);
                }
              });
            }
          ], function(err) {
            if (!submissionId) {
              if (tryLogin) {
                return that._login(function(err, logged) {
                  if (!logged) return callback({name: 'Não consegue logar.', retry: true});
                  return that._send(probNum, codeString, language, false, callback);
                });
              } else {
                return callback(err);
              }
            } else {
              return callback(null, submissionId);
            }
          });
        };

        this._send = _send;
        this._judge = function(submissions, callback) {
          rest.get('http://dev.thehuxley.com/api/v1/submissions?max=20').on('complete', function(result) {
            if (result instanceof Error) {
              return callback();
            }
            for (var i = 0; i < result.length; i++) {
              if (submissions[result[i].id]) {
                that.events.emit('verdict', result[i].id, result[i].evaluation);
              }
            }
            return callback();
          });
        }
    }

    cls.fetchProblems = function() {
      const maxPerPage = 100;

      var iterate = function(i, cb) {
        var offset = (i-1)*maxPerPage;
        rest.get(`http://dev.thehuxley.com/api/v1/problems?max=${maxPerPage}&offset=${offset}`).on('complete', function(result) {
          for (var j = 0; j < result.length; j++) {
            Problem.createNew(result[j].id, result[j].name, OJ_NAME);
          }
          if (result.length == maxPerPage) {
            return setImmediate(iterate.bind(null, i+1, cb));
          } else {
            return cb();
          }
        });
      }

      iterate(1, function(err) {
        console.log('Finished loading up problems from ' + CONFIG.name);
      });
    }
    //cls.fetchProblems();

    return cls;
})(Adapter);
