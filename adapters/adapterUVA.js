const fs = require('fs');
const path = require('path');

const async = require('async');

const RequestClient = require('../utils/requestClient');
const util = require('../utils/util');
const Adapter = require('../adapters/adapter');

const UVA_HOST = "uva.onlinejudge.org";
const SUBMIT_PAGE_PATH = "/index.php?option=com_onlinejudge&Itemid=25";
const SUBMIT_PATH = "/index.php?option=com_onlinejudge&Itemid=25&page=save_submission";

const LOGGED_PATTERN = /My\s+Account/i;

const LOGIN_FORM_PATTERN =
    // group 1: form attribs
    // group 2: form HTML contents
    /<form([^>]+?id\s*=\s*["']?\w*mod_loginform[^>]*)>((?:.|\r|\n)*?)<\/form>/i;

const INPUT_PATTERN =
    // group 1: attribs
    /<input([^>]+?)\/?>/gi;

module.exports = (function(parentCls){
    // constructor
    function cls(acct) {
        // super constructor call
        parentCls.call(this, acct);

        // private instance fields
        var uvaClient = new RequestClient('https', UVA_HOST);

        var that = this;

        // public instance method
        this._login = function(callback){
            async.waterfall([
                function(subCallback){
                    uvaClient.get('/', subCallback);
                },
                function(res, html, subCallback){
                    var f = cls.parseForm(LOGIN_FORM_PATTERN, html);
                    var err = null;
                    if (!f)
                        err = ("cannot find HTML form");
                    else if (!f.userField)
                        err = ("cannot find user field");
                    else if (!f.passField)
                        err = ("cannot find pass field");
                    else if (!f.action)
                        err = ("cannot find action");

                    if (err)
                        return subCallback(new Error(err));

                    f.data[f.userField] = acct.user();
                    f.data[f.passField] = acct.pass();
                    var opts = {
                        // Must not follow otherwise will miss the session cookie.
                        followAllRedirects: true,
                        headers: {
                            Referer: 'https://' + UVA_HOST,
                        },
                    };
                    uvaClient.post(f.action, f.data, opts, subCallback);
                }
            ],
            function(err, res, html) {
                html = html || '';
                return callback(err, !!html.match(LOGGED_PATTERN));
            });
        };

        var counter = 0;
        this._send = function(probNum, codeString, language, tryLogin, callback) {
            var langVal = cls.getLangVal(util.getLang(language));
            if (langVal < 0) {
                return callback(new Error('Linguagem desconhecida.'));
            }

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
            uvaClient.postMultipart(SUBMIT_PATH, data, opts, function(err, res, html){
                if (err) {
                    return callback(err);
                } else if (html.match(/not\s+authori[zs]ed/i)) {
                    if (tryLogin) {
                        return that._login(function(err, logged) {
                            if (!logged) return callback(new Error('Can\'t login.'));
                            return that._send(probNum, codeString, language, false, callback);
                        });
                    } else {
                        return callback(new Error('Can\'t submit.'));
                    }
                } else {
                    callback(null);
                }
            });
        };
    }

    cls.parseForm = function(formPat, html){
        var match = formPat.exec(html);
        if (! match) return null;

        var attribs = match[1];
        var contents = match[2];
        var atts = util.parseAttribs(attribs);
        var r = {contents: contents, data: {}};

        for (var key in atts)
        {
            if (key.toLowerCase() === 'action')
            {
                r.action = util.htmlDecodeSimple(atts[key]);
                break;
            }
        }

        while(match = INPUT_PATTERN.exec(contents))
        {
            atts = util.parseAttribs(match[1]);
            var value = null, name = null, isText = false;

            for (var key in atts)
            {
                var val = util.htmlDecodeSimple(atts[key]);
                var keyLower = key.toLowerCase();
                var valLower = val.toLowerCase();

                switch(keyLower)
                {
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

            if (name !== null && isText)
            {
                var nameLower = name.toLowerCase();
                if (nameLower.indexOf("user") >= 0)
                    r.userField = name;
                else if (nameLower.indexOf("pass")>=0)
                    r.passField = name;
            }
            else if (value !== null && name !== null)
            {
                r.data[name] = value;
            }
        }

        return r;
    };

    /**
     * @param lang One of LANG_* constants
     * @return UVA lang value or -1 if unacceptable.
     */
    cls.getLangVal = function(lang){
        switch (lang)
        {
        case util.LANG_C: return 1;
        case util.LANG_JAVA: return 2;
        case util.LANG_CPP: return 3;
        case util.LANG_PASCAL: return 4;
        case util.LANG_CPP11: return 5;
        }

        return -1;
    };

    cls.getLang = function(id)
    {
        switch(id)
        {
        case 1: return "C";
        case 2: return "Java";
        case 3: return "C++";
        case 4: return "Pascal";
        case 5: return "C++11";
        }

        return "?";
    };

    return cls;
})(Adapter);
