'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      _       = require('lodash'),
      fs      = require('fs');

const Adapter       = require('../adapters/adapter'),
      Defaults      = require('../config/defaults'),
      Errors        = require('../utils/errors'),
      RequestClient = require('../utils/requestClient'),
      Util          = require('../utils/util');

const HOST              = "www.codechef.com",
      SUBMIT_PATH       = "/submit/%s",
      SESSION_LIMIT     = "/session/limit";

const LOGGED_PATTERN              = /edit\s+profile/i,
      LIMIT_CON_PATTERN           = /session\s+to\s+disconnect/i,
      LOGIN_FORM_PATTERN          = /<form([^>]+?id\s*=\s*["']?\w*new-login-form[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SUBMIT_FORM_PATTERN         = /<form([^>]+?id\s*=\s*["']?\w*problem-submission[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      SESSION_LIMIT_FORM_PATTERN  = /<form([^>]+?id\s*=\s*["']?\w*session-limit-page[^>]*)>((?:.|\r|\n)*?)<\/form>/i;

const TYPE = /^adapter(\w+)/i.exec(path.basename(__filename))[1].toLowerCase();

module.exports = ((parentCls) => {

  function AdapterCODECHEF(acct) {
    parentCls.call(this, acct);
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp')
    }

    const client = new RequestClient('https', HOST);
    const Settings = Defaults.oj[TYPE];

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
          headers: { Referer: 'https://' + HOST, },
        };
        f.data.sid = sid;
        client.post(SESSION_LIMIT, f.data, opts, (err, res, _html) => {
          html = _html
          if (err || !html) return callback()
          fs.writeFileSync('stor.html', html, 'utf8')
          return next()
        })
      }, (err) => {
        return callback(err)
      })
    }

    this._login = login;

    function send(submission, retry, callback) {
      let dirPath, filePath;
      let langName = _.findKey(Settings.submitLang, (o) => {
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
              headers: { Referer: 'https://' + HOST },
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
          console.log(id)
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
    const VOLUMES = ["/index.php?option=com_onlinejudge&Itemid=8&category=1",
                     "/index.php?option=com_onlinejudge&Itemid=8&category=2"];
    const PROBLEM_PATTERN = /^(\d+)\s*-\s*(.*)/i;
    const client = new RequestClient('https', HOST);
    const PDF_FROM_ID = 500;

    const PROBLEM_METADATA_API = "http://uhunt.felix-halim.net/api/p/num/%s";

    function getContent(data, html, id) {
      html = html.replace(/<=/g, '&lt;=');
      let $ = cheerio.load(html);
      let body = $('body');
      $('img').each((i, elem) => {
        elem = $(elem);
        let vol = parseInt(id / 100);
        let imgUrl = `${Defaults.oj[TYPE].url}/external/${vol}/${elem.attr('src')}`;
        elem.attr('src', imgUrl);
      });
      body.find('table[bgcolor="#0060F0"]').first().remove();
      body.find('h1').first().remove();
      body.find('h2').each((i, item) => {
        $(item).html($(item).text());
      });
      let adr = body.find('address');
      if (adr) {
        adr.children().each((i, item) => {
          let text = _.trim($(item).text());
          if (text.length > 0) {
            if (data.source) data.source += ' ' + text;
            else data.source = text;
          }
        });
        adr.prev().remove();
        adr.remove();
      }
      data.html = '<div class="problem-statement">' + body.html() + '</div>';
    }

    obj.import = (problem, callback) => {
      let metadataUrl = util.format(PROBLEM_METADATA_API, problem.id);
      let problemUrl = Defaults.oj[TYPE].getProblemPath(problem.id);
      async.parallel({
        meta: (next) => {
          return client.get(metadataUrl, {json: true}, next);
        },
        body: (next) => {
          if (parseInt(problem.id) >= PDF_FROM_ID) {
            return next(null, {isPdf: true}, null);
          }
          return client.get(problemUrl, next);
        }
      }, (err, results) => {
        if (err) return callback(err);
        let data = {};
        try {
          let tl = results.meta[1] && results.meta[1].rtl || 3000;
          data.timelimit = tl / 1000.0;
          data.memorylimit = '128 MB';
          let html = results.body[1];
          data.isPdf = results.body[0].isPdf ||
                       (_.includes(html, "HTTP-EQUIV") && html.length <= 200);
          if (!data.isPdf) getContent(data, html, problem.id);
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
        $('tr.sectiontableheader').nextAll().each((i, elem) => {
          elem = $(elem).children().eq(2).text();
          let res = PROBLEM_PATTERN.exec(elem);
          if (res && res[1] && res[2]) {
            problems.push({
              id: res[1],
              name: res[2],
              oj: TYPE
            });
          }
        });
        return callback(null, problems);
      });
    }

    function reduceVolumes(problems, volumePath, callback) {
      async.waterfall([
        (next) => {
          client.get(volumePath, next);
        },
        (res, html, next) => {
          html = html || '';
          let $ = cheerio.load(html);
          let volumesHref = [];
          $('a:contains("Volume ")').each((i, elem) => {
            volumesHref.push('/' + $(elem).attr('href'));
          });
          async.reduce(volumesHref, problems, reduceProblems, next);
        }
      ], callback);
    }

    obj.fetchProblems = (callback) => {
      async.reduce(VOLUMES, [], reduceVolumes, callback);
    }
  })(AdapterCODECHEF);

  return AdapterCODECHEF;
})(Adapter);
