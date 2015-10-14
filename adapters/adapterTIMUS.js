const fs = require('fs'),
      path = require('path'),
      async = require('async'),
      assert = require('chai').assert,
      cheerio = require('cheerio'),
      request = require('request');

const RequestClient = require('../utils/requestClient'),
      Adapter = require('../adapters/adapter'),
      config = require('../config/defaults'),
      errors = require('../utils/errors');

const TIMUS_HOST = "acm.timus.ru",
      SUBMIT_PAGE_PATH = "/submit.aspx",
      SUBMIT_PATH = "/submit.aspx?space=1",
      STATUS_PATH = "/status.aspx?space=1&count=50";

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
      INPUT_PATTERN = /<input([^>]+?)\/?>/gi;

const OJ_NAME = "timus",
      CONFIG = config.oj[OJ_NAME];

module.exports = (function(parentCls){
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        var that = this;
        var timusClient = new RequestClient('http', TIMUS_HOST);

        var _send = function(probNum, codeString, language, _ignore, callback) {
          var langVal = CONFIG.submitLang[language];
          if (!langVal) return callback(errors.InvalidLanguage);
          
          var data = {
              Action: 'submit',
              SpaceID: '1',
              JudgeID: acct.pass,
              Language: langVal,
              ProblemNum: probNum,
              Source: codeString,
              SourceFile: ''
          };
          var opts = {
              followAllRedirects: false,
              headers: {
                  Referer: 'http://' + TIMUS_HOST + SUBMIT_PAGE_PATH,
              },
          };
          timusClient.postMultipart(SUBMIT_PATH, data, opts, function(err, res, html) {
              if (err)
                  return callback(err);
              if (html.match(/Invalid\s+JUDGE_ID/i))
                  return callback(errors.LoginFail);
              if (html.match(/between\s+submissions/i))
                  return callback(errors.SubmissionFail);
              timusClient.get(STATUS_PATH, function(err, res, html) {
                if (err) return callback(err);
                try {
                  var $ = cheerio.load(html);
                  var row = $('a[href="author.aspx?id='+ acct.user +'"]:first-child').parent().parent();
                  var id = row.children('td.id:first-child').html();
                  assert(id && id.length >= 6, 'submission id is valid');
                } catch (e) {
                  return callback(e);
                }
                return callback(null, id);
              });
          });
        };

        this._send = _send;
        this._judge = function(submissions, callback) {
          request({
              url: 'http://' + TIMUS_HOST + STATUS_PATH + '&author=' + acct.getUser()
          }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
              return callback();
            }
            var $ = cheerio.load(body);
            for (var id in submissions) {
              var data = null;
              try {
                data = $('a:contains("' + id + '")');
                data = data.parent().next().next().next().next().next();
                if (!data.find('a').html()) {
                  data = data.html();
                } else {
                  data = data.find('a').html();
                }
              } catch(e) {}
              that.events.emit('verdict', id, data);
            }
            return callback();
          });
        }
    }

    return cls;
})(Adapter);
