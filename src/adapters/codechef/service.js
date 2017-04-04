'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      _       = require('lodash'),
      fs      = require('fs');

const Adapter       = require('../adapter'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util'),
      Defaults      = require('../../config/defaults'),
      Config        = require('./config')

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

const TYPE = path.basename(__dirname);

module.exports = ((parentCls) => {

  function AdapterCODECHEF(acct) {
    parentCls.call(this, acct);
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp')
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
            f = Util.parseForm(LOGIN_FORM_PATTERN, html);
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
          return handleSessionLimit(html, callback)
        }
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail)
        }
        return callback()
      });
    };

    function handleSessionLimit(html, callback) {
      async.forever((next) => {
        let $ = cheerio.load(html)
        let sid = $('#session-limit-page .form-radios .form-item input:not(:contains("current"))').first().val()
        if (!sid) return callback()
        let f = Util.parseForm(SESSION_LIMIT_FORM_PATTERN, html);
        if (!f) return callback(Errors.LoginFail)
        let opts = {
          followAllRedirects: true,
          headers: { Referer: Config.url, },
        };
        f.data.sid = sid;
        client.post(SESSION_LIMIT, f.data, opts, (err, res, _html) => {
          html = _html
          if (err || !html) return callback()
          return next()
        })
      }, (err) => {
        return callback(err)
      })
    }

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
          client.get(util.format(SUBMIT_PATH, submission.problemId), next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(SUBMIT_FORM_PATTERN, html);
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
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      let userSubmissionsPath = util.format(
          SUBMISSIONS_PATH,
          acct.getUser(),
          1000000000 + Math.floor(Math.random()*1000000000));
      client.get(userSubmissionsPath, (err, res, html) => {
        fs.writeFileSync('lol.html', html, 'utf8');
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

  // Problems Fetcher
  (function(obj) {
    const VOLUMES = ["/problems/school/",
                     "/problems/easy/",
                     "/problems/medium/",
                     "/problems/hard/",
                     "/problems/extcontest/"];

    const PROBLEMS_PATH_UNF = "/api/contests/PRACTICE/problems/%s"

    const client = new RequestClient(Config.url);

    obj.import = (problem, callback) => {
      let urlPath = util.format(PROBLEMS_PATH_UNF, problem.id);
      client.get(urlPath, {json: true}, (err, res, meta) => {
        if (err) return callback(err);
        let data = {};
        try {
          if (meta.status !== 'success') {
            throw new Error("Problem could not be fetched.");
          }
          let supportedLangs = Config.getSupportedLangs(meta.languages_supported);
          if (supportedLangs.length === 0) {
            throw new Error(`Problem ${problem.id} doesn't support any language`);
          }
          data.supportedLangs = supportedLangs;
          let html = meta.body.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
          let $ = cheerio.load(html);
          Util.adjustAnchors($, Config.url + urlPath);
          $('.solution-visible-txt').remove();
          while (true) {
            let firstElem = $('*').first();
            if (!firstElem.is('h3')) {
              break;
            }
            firstElem.remove();
          }
          let trimmedHtml = _.trim($.html(), '\n');
          assert(trimmedHtml.length > 0);
          data.html =
            '<div id="codechef" class="problem-statement ttypography">' +
              trimmedHtml +
            '</div>';
          if (meta.problem_author) {
            data.source = `Author: ${meta.problem_author}`;
          }
          if (/[^0-9.,]*([0-9.,]+)/.exec(meta.max_timelimit)) {
            meta.max_timelimit = /[^0-9.,]*([0-9.,]+)/.exec(meta.max_timelimit)[1];
            data.timelimit = parseFloat(meta.max_timelimit);
          }
        } catch (err) {
          return callback(err);
        }
        return callback(null, data);
      });
    }

    function reduceProblems(problems, href, callback) {
      client.get(href, (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        $('tr.problemrow').nextAll().each((i, elem) => {
          try {
            let name = _.trim($(elem).find('.problemname').text());
            let id = _.replace($(elem).find('.problemname a').attr('href'), '/problems/', '');
            if (name && id) {
              problems.push({
                id: id,
                name: name,
                oj: TYPE
              });
            }
          } catch (e) {}
        });
        return callback(null, problems);
      });
    }

    obj.fetchProblems = (callback) => {
      async.reduce(VOLUMES, [], reduceProblems, callback);
    }
  })(AdapterCODECHEF);

  return AdapterCODECHEF;
})(Adapter);
