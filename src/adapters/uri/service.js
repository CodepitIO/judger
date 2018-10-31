'use strict';

const path    = require('path'),
      async   = require('async'),
      assert  = require('assert'),
      Browser = require('zombie'),
      util    = require('util'),
      cheerio = require('cheerio'),
      request = require('request'),
      _       = require('lodash');

const Adapter       = require('../adapter'),
      Errors        = require('../../../common/errors'),
      RequestClient = require('../../../common/lib/requestClient'),
      Utils         = require('../../../common/lib/utils');

const TYPE = path.basename(__dirname);
const Config = Utils.getOJConfig(TYPE);

const LOGIN_PAGE_PATH       = "/judge/en/login",
      SUBMIT_PAGE_PATH      = "/judge/en/runs/add";

const LOGIN_TEST_REGEX = /\/judge\/en\//i;

module.exports = (function(parentCls) {

  function AdapterURI(acct) {
    parentCls.call(this, acct);

    AdapterURI.accessKey = acct.getAccessKey();

    const browser = new Browser({runScripts: false, strictSSL: false});
    const client = new RequestClient(Config.url);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + LOGIN_PAGE_PATH, next);
        },
        (next) => {
          browser
            .fill('#email', acct.getUser())
            .fill('#password', acct.getPass())
            .check('#remember-me')
            .pressButton('input.send-green.send-right', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!html.match(LOGIN_TEST_REGEX)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    }

    this._login = login;

    function getSubmissionId(submission, callback, data, index) {
      if (data !== undefined) {
        console.log('getSubmissionId data call')
        console.log(data)
        if (index < data.length) {
          let sub_id = data[index].id
          async.waterfall([
            (next) => {
              console.log(sub_id)
              browser.visit('https://www.urionlinejudge.com.br/judge/en/runs/code/' + sub_id, next)
            },
            (next) => {
              console.log({'data': submission.code})
              console.log({'data': browser.query('pre')._childNodes[0]._data})
              if(browser.query('pre')._childNodes[0]._data == submission.code){
                return callback(null, sub_id)
              } else {
                return getSubmissionId(submission, callback, data, index + 1)
              }
            }
          ])
        } else {
          return callback('ERRO')
        }
      } else {
        console.log('getSubmissionId call')
        let url = 'https://api.urionlinejudge.com.br/users/submissions/' + acct.getId() + '?sort=created&direction=desc';
        request(url, {json: true, headers:{
          'content-type': 'application/json',
          'accept': 'application/json',
          'authorization': 'Bearer ' + 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjE3LCJleHAiOjE1NDE2MTA0OTF9.WLDOhv3IWGv0Bj7tb_EDQk8WMWd0w0GRbtVNagKd17o',
        }
        }, (err, res, data) => {
          if (err) return callback(err);
          return getSubmissionId(submission, callback, data.runs, 0)
        })
      }
    }

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
        },
        (next) => {
          browser
            .fill('#problem-id', submission.problemId)
            .select('#language-id', submission.language)
            .fill('#source-code', submission.code)
            .pressButton('input.send-green', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (err) {
          return callback(err);
        } else if (browser.location.pathname === LOGIN_PAGE_PATH) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(submission, callback);
      });
    }

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    };

    function judge(judgeSet, callback) {
      console.log(judgeSet)
      let url = 'https://api.urionlinejudge.com.br/users/submissions/' + acct.getId() + '?sort=created&direction=desc';
      request(url, {json: true, headers:{
        'content-type': 'application/json',
        'accept': 'application/json',
        'authorization': 'Bearer ' + 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjE3LCJleHAiOjE1NDE2MTA0OTF9.WLDOhv3IWGv0Bj7tb_EDQk8WMWd0w0GRbtVNagKd17o',
      }
      }, (err, res, data) => {
        if (err) return callback(err);
        for(let run of data.runs) {
          if(judgeSet[run.id]){
            judgeSet[run.id].verdict = run.answer
          }
        }
        return callback()
      })
    }

    this._judge = judge;
  }

  return AdapterURI;
})(Adapter);
