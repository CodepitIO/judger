const fs = require('fs');
const path = require('path');

const async = require('async');

const RequestClient = require('../utils/requestClient');
const util = require('../utils/util');
const Adapter = require('../adapters/adapter');

const TIMUS_HOST = "acm.timus.ru";
const SUBMIT_PAGE_PATH = "/submit.aspx";
const SUBMIT_PATH = "/submit.aspx?space=1";

const SUBMIT_FORM_PATTERN =
    // group 1: form attribs
    // group 2: form HTML contents
    /<form([^>]+?)>((?:.|\n)*?)<\/form>/i;

const INPUT_PATTERN =
    // group 1: attribs
    /<input([^>]+?)\/?>/gi;

module.exports = (function(parentCls){
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        // private instance fields
        var timusClient = new RequestClient('http', TIMUS_HOST);

        // public instance method
        this._login = function(callback) {};

        var counter = 0;
        this._send = function(probNum, codeString, language, _ignore, callback) {
          var langVal = cls.getLangVal(util.getLang(language));
          if (langVal < 0) {
              return callback(new Error('Linguagem desconhecida.'));
          }
          
          var data = {
              Action: 'submit',
              SpaceID: '1',
              JudgeID: '166862LG',
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
                  return callback(new Error('cannot login. password correct?'));
              if (html.match(/between\s+submissions/i))
                  return callback(new Error('too fast, try again.'));
              callback(null);
          });
        };
    }

    /**
     * @param lang One of LANG_* constants
     * @return SPOJ lang value or -1 if unacceptable.
     */
    cls.getLangVal = function(lang){
        switch (lang)
        {
        case util.LANG_C: return 25;
        case util.LANG_JAVA: return 32;
        case util.LANG_CPP: return 26;
        case util.LANG_PASCAL: return 31;
        case util.LANG_CPP11: return 28;
        }

        return -1;
    };

    return cls;
})(Adapter);
