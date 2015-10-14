const fs = require('fs'),
      path = require('path'),
      assert = require('chai').assert,
      async = require('async'),
      cheerio = require('cheerio'),
      request = require('request');

const RequestClient = require('../utils/requestClient'),
      Adapter = require('../adapters/adapter'),
      util = require('../utils/util'),
      config = require('../config/defaults'),
      errors = require('../utils/errors');

const UVA_HOST = "uva.onlinejudge.org",
      SUBMIT_PAGE_PATH = "/index.php?option=com_onlinejudge&Itemid=25",
      SUBMIT_PATH = "/index.php?option=com_onlinejudge&Itemid=25&page=save_submission",
      SUBMISSIONS_PATH = '/index.php?option=com_onlinejudge&Itemid=9';

const LOGGED_PATTERN = /My\s+Account/i;
      LOGIN_FORM_PATTERN = /<form([^>]+?id\s*=\s*["']?\w*mod_loginform[^>]*)>((?:.|\r|\n)*?)<\/form>/i;
      INPUT_PATTERN = /<input([^>]+?)\/?>/gi;

const OJ_NAME = "uva",
      CONFIG = config.oj[OJ_NAME];

module.exports = (function(parentCls){
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        var that = this;
        var uvaClient = new RequestClient('https', UVA_HOST);

        var _login = function(callback) {
            async.waterfall([
                function(subCallback){
                    uvaClient.get('/', subCallback);
                },
                function(res, html, subCallback) {
                    try {
                        var f = cls.parseForm(LOGIN_FORM_PATTERN, html);
                        f.data[f.userField] = acct.getUser();
                        f.data[f.passField] = acct.getPass();
                        var opts = {
                            followAllRedirects: true,
                            headers: { Referer: 'https://' + UVA_HOST, },
                        };
                    } catch (e) {
                        return subCallback(errors.SubmissionFail, res, html);
                    }
                    uvaClient.post(f.action, f.data, opts, subCallback);
                }
            ],
            function(err, res, html) {
                html = html || '';
                if (!!html.match(LOGGED_PATTERN)) return callback(null, true);
                return callback(err, false);
            });
        };

        var _send = function(probNum, codeString, language, tryLogin, callback) {
            var langVal = CONFIG.submitLang[language];
            if (!langVal) return callback(errors.InvalidLanguage);

            var data = {
                localid: probNum,
                code: codeString,
                language: langVal,
                codeupl: '',
                problemid: '',
                category: '',
            };
            var opts = {
                headers: {
                    Referer: 'https://' + UVA_HOST + SUBMIT_PAGE_PATH,
                },
            };
            uvaClient.postMultipart(SUBMIT_PATH, data, opts, function(err, res, html) {
                if (err) return callback(err);
                if (html.match(/not\s+authori[zs]ed/i)) {
                    if (!tryLogin) {
                        return callback(errors.LoginFail);
                    } else {
                        return _login(function(err, logged) {
                            if (!logged) return callback(errors.LoginFail);
                            return _send(probNum, codeString, language, false, callback);
                        });
                    }
                }
                try {
                    var id = /([0-9]{6,15})/.exec(res.req.path)[0];
                    assert(id && id.length >= 6, 'submission id is valid');
                } catch (err) {
                    return callback(err);
                }
                return callback(null, id);
            });
        };

        this._send = _send;
        this._judge = function(submissions, callback) {
            async.waterfall([
                function(subCallback){
                    uvaClient.get(SUBMISSIONS_PATH, subCallback);
                },
                function(res, html, subCallback) {
                    html = html || '';
                    if (!html.match(LOGGED_PATTERN)) {
                        _login(function(err, logged) {
                            if (!logged) return callback();
                            return uvaClient.get(SUBMISSIONS_PATH, subCallback);
                        });
                    } else {
                        return subCallback(null, null, html);
                    }
                }
            ],
            function(err, res, html) {
                if (!html) return callback();
                var $ = cheerio.load(html);
                for (var id in submissions) {
                  var data = null;
                  try {
                    data = $('td:contains("' + id + '")');
                    data = data.next().next().next();
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

    cls.parseForm = function(formPat, html){
        var match = formPat.exec(html);
        if (! match) return null;

        var attribs = match[1];
        var contents = match[2];
        var atts = util.parseAttribs(attribs);
        var r = {contents: contents, data: {}};

        for (var key in atts) {
            if (key.toLowerCase() === 'action') {
                r.action = util.htmlDecodeSimple(atts[key]);
                break;
            }
        }

        while(match = INPUT_PATTERN.exec(contents)) {
            atts = util.parseAttribs(match[1]);
            var value = null, name = null, isText = false;

            for (var key in atts) {
                var val = util.htmlDecodeSimple(atts[key]);
                var keyLower = key.toLowerCase();
                var valLower = val.toLowerCase();

                switch(keyLower) {
                case 'type':
                    isText = (valLower === 'password' || valLower === 'text');
                    break;
                case 'name':
                    name = val;
                    break;
                case 'value':
                    value = val;
                    break;
                }
            }

            if (name !== null && isText) {
                var nameLower = name.toLowerCase();
                if (nameLower.indexOf("user") >= 0)
                    r.userField = name;
                else if (nameLower.indexOf("pass")>=0)
                    r.passField = name;
            } else if (value !== null && name !== null) {
                r.data[name] = value;
            }
        }

        return r;
    };

    return cls;
})(Adapter);
