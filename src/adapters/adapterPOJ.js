'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util'),
      iconv   = require('iconv-lite'),
      _       = require('lodash');

const Adapter       = require('../adapters/adapter'),
      Defaults      = require('../config/defaults'),
      Errors        = require('../utils/errors'),
      RequestClient = require('../utils/requestClient'),
      Util          = require('../utils/util');

const HOST              = "poj.org",
      LOGIN_PATH   = "/login",
      SUBMIT_PATH  = "/submit",
      SUBMISSIONS_PATH  = "/status?user_id=%s";

const LOGGED_PATTERN          = /Log\s+Out/i,
      LOGIN_FORM_PATTERN      = /<form([^>]+?action\s*=\s*["']?\w*login[^>]*)>((?:.|\r|\n)*?)<\/form>/i,
      NOT_AUTHORIZED_PATTERN  = /Please\s+login\s+first/i;

const TYPE = /^adapter(\w+)/i.exec(path.basename(__filename))[1].toLowerCase();

module.exports = ((parentCls) => {

  function AdapterLA(acct) {
    parentCls.call(this, acct);

    const client = new RequestClient('http', HOST);

    function login(callback) {
      async.waterfall([
        (next) => {
          client.get(LOGIN_PATH, next);
        },
        (res, html, next) => {
          let f, opts;
          try {
            f = Util.parseForm(LOGIN_FORM_PATTERN, html);
            f.data[f.userField] = acct.getUser();
            f.data[f.passField] = acct.getPass();
            opts = {
              followAllRedirects: true,
              headers: { Referer: 'http://' + HOST, },
            };
          } catch (e) {
            return next(Errors.SubmissionFail, res, html);
          }
          return client.post(LOGIN_PATH, f.data, opts, next);
        }
      ], (err, res, html) => {
        html = html || '';
        if (!html.match(LOGGED_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    this._login = login;

    function getSubmissionId(html, callback) {
      let id;
      try {
        let $ = cheerio.load(html);
        let elem = $('table.a tr:nth-child(2)');
        if (elem.find('td:nth-child(2) a').text() === acct.getUser()) {
          id = elem.find('td:first-child').text();
          console.log(id);
        }
       assert(id && id.length >= 6);
      } catch (e) {
        console.log(e);
        return callback(e);
      }
      return callback(null, id);
    };

    function send(submission, retry, callback) {
      let data = {
        problem_id: submission.problemId,
        source: new Buffer(submission.code).toString('base64'),
        language: submission.language,
        submit: 'Submit',
        encoded: '1',
      };
      let opts = {
        headers: {
          Referer: 'http://' + HOST + SUBMIT_PATH,
        },
      };
      client.post(SUBMIT_PATH, data, opts, (err, res, html) => {
        if (err) return callback(err);
        html = html || '';
        if (html.match(NOT_AUTHORIZED_PATTERN)) {
          if (!retry) {
            return callback(Errors.SubmissionFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        }
        return getSubmissionId(html, callback);
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      client.get(util.format(SUBMISSIONS_PATH, acct.getUser()), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('td:contains("' + id + '")');
            data = data.nextAll().eq(4);
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
    const VOLUMES = ["/index.php?option=com_onlinejudge&Itemid=8&category=1"];
    const PROBLEM_PATTERN = /^(\d+)\s*-\s*(.*)/i;
    const client = new RequestClient('https', HOST);

    const PROBLEM_METADATA_API = "https://icpcarchive.ecs.baylor.edu/uhunt/api/p/num/%s";

    function getContent(data, html, id) {
      if (!_.includes(html, '<body>')) {
        html = `<body>${html}</body>`
      }
      html = html.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
      let $ = cheerio.load(html);
      $('img').each((i, elem) => {
        elem = $(elem);
        let vol = parseInt(id / 100);
        let imgUrl = `${Defaults.oj[TYPE].url}/external/${vol}/${elem.attr('src')}`;
        elem.attr('src', imgUrl);
      });
      $('a').each((i, elem) => {
        elem = $(elem);
        let href = elem.attr('href')
        if (href && href[0] === '/') {
          elem.attr('href', '//' + HOST + href)
        }
      });
      $('table[bgcolor="#0060F0"]').first().remove();
      $('h1').first().remove();
      $('h2').each((i, item) => {
        $(item).html($(item).text());
      });
      let adr = $('address');
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
      data.html = '<div class="problem-statement">' + $.html() + '</div>';
    }

    obj.import = (problem, callback) => {
      let metadataUrl = util.format(PROBLEM_METADATA_API, problem.id);
      let problemUrl = Defaults.oj[TYPE].getProblemPath(problem.id);
      async.parallel({
        meta: (next) => {
          return client.get(metadataUrl, {json: true}, next)
        },
        body: (next) => {
          return client.get(problemUrl, {encoding: null}, next)
        }
      }, (err, results) => {
        if (err) return callback(err);
        let data = {};
        try {
          let tl = results.meta[1] && results.meta[1].rtl || 3000;
          data.timelimit = tl / 1000.0;
          data.memorylimit = '128 MB';
          let html = iconv.decode(results.body[1], 'ISO-8859-1')
          data.isPdf = (_.includes(html, "HTTP-EQUIV") && html.length <= 200)
          if (!data.isPdf) getContent(data, html, problem.id)
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
  })(AdapterLA);

  return AdapterLA;
})(Adapter);