'use strict';

const path      = require('path'),
      async     = require('async'),
      Browser   = require('zombie'),
      assert    = require('assert'),
      cheerio   = require('cheerio'),
      util      = require('util'),
      fs        = require('fs'),
      _         = require('lodash')

const Adapter       = require('../adapters/adapter'),
      Defaults      = require('../config/defaults'),
      Errors        = require('../utils/errors'),
      RequestClient = require('../utils/requestClient'),
      Util          = require('../utils/util')

const LOGIN_PATH  = path.join(__dirname, "resources", "spoj_login.html"),
      SUBMIT_PATH = path.join(__dirname, "resources", "spoj_submit.html");

const HOST        = "www.spoj.com",
      STATUS_PATH = "/status";

const LOGIN_TEST_ANTI_REGEX     = /sign\s+up/i,
      AUTH_REQUIRED_TEST_REGEX  = /authori[sz]ation\s+required/i,
      WRONG_LANGUAGE_REGEX      = /submit\s+in\s+this\s+language/i;

const TYPE = /^adapter(\w+)/i.exec(path.basename(__filename))[1].toLowerCase();

module.exports = (function(parentCls) {

  function AdapterSPOJ(acct) {
    parentCls.call(this, acct);

    const browser = new Browser({runScripts: false, waitDuration: "15s"});
    const client = new RequestClient('http', HOST);

    function login(callback) {
      async.waterfall([
        (next) => {
          browser.visit("file://" + LOGIN_PATH, next);
        },
        (next) => {
          browser
            .fill('login_user', acct.getUser())
            .fill('password', acct.getPass())
            .check('autologin')
            .pressButton('submit', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (!!html.match(LOGIN_TEST_ANTI_REGEX)) {
          return callback(Errors.LoginFail);
        }
        return callback();
      });
    };

    this._login = login;

    function getSubmissionId(callback) {
      let id;
      try {
        let $ = cheerio.load(browser.html() || '');
        id = $('input[name="newSubmissionId"]').val();
        assert(id && id.length >= 6)
      } catch (e) {
        return callback(e);
      }
      return callback(null, id);
    };

    function send(submission, retry, callback) {
      async.waterfall([
        (next) => {
          browser.visit('file://' + SUBMIT_PATH, next);
        },
        (next) => {
          browser
            .fill('input[name="problemcode"]', submission.problemId)
            .select('select[name="lang"]', submission.language)
            .fill('textarea', submission.code)
            .pressButton('input[value="Send"]', next);
        }
      ], (err) => {
        let html = browser.html() || '';
        if (err) {
          return callback(err);
        } else if (html.match(AUTH_REQUIRED_TEST_REGEX)) {
          if (!retry) {
            return callback(Errors.LoginFail);
          } else {
            return login((err) => {
              if (err) return callback(err);
              return send(submission, false, callback);
            });
          }
        } else if (html.match(WRONG_LANGUAGE_REGEX)) {
          return callback(Errors.InternalError);
        } else {
          return getSubmissionId(callback);
        }
      });
    };

    this._send = (submission, callback) => {
      return send(submission, true, callback);
    }

    function judge(judgeSet, callback) {
      client.get(STATUS_PATH + '/' + acct.getUser(), (err, res, html) => {
        html = html || '';
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          try {
            let data = $("#statusres_" + id).attr('status');
            if (data) {
              judgeSet[id].verdict = data;
            }
          } catch (err) {}
        }
        return callback();
      });
    };

    this._judge = judge;
  }

  // Problems Fetcher
  (function(obj) {
    const VOLUMES = ["classical", "tutorial", "riddle", "basics"];
    const PROBLEMS_PATH_UNF = "/problems/%s/start=%s";

    const maxPerPage = 50;

    const LAST_PAGE_PATTERN = /start=(\d+)/;
    const PROBLEM_ID_PATTERN = /^\/problems\/(.+)/;
    const METADATA_PATTERN = /^(?:.+)?:\s*(.+)/i;
    const TIMELIMIT_PATTERN = /([\d.,]+)/;
    const MEMOLIMIT_PATTERN = /([\d.,]+)\s*(\w+)/;

    const tmplPath = './src/adapters/resources/spoj_template.html';
    const tmpl = _.template(fs.readFileSync(tmplPath, 'utf8'));

    const client = new RequestClient('http', HOST);

    function getMetadata(elem) {
      try {
        return elem.text().match(METADATA_PATTERN)[1];
      } catch (err) {
        return null;
      }
    }

    obj.import = (problem, callback) => {
      let url = Defaults.oj[TYPE].getProblemPath(problem.id);
      client.get(url, (err, res, html) => {
        if (err) return callback(err);
        let data = {};
        try {
          html = html.replace(/<=/g, '&lt;=');
          let $ = cheerio.load(html);
          Util.adjustImgSrcs($, TYPE);
          $('h3').replaceWith(function () {
            return "<div class='section-title'>" + $(this).html() + "</div>";
          });
          let header = $('#problem-meta tbody').children(), match;
          let tl = getMetadata(header.eq(2));
          if (tl && (match = tl.match(TIMELIMIT_PATTERN))) {
            data.timelimit = parseFloat(match[1]);
          }
          let ml = getMetadata(header.eq(4));
          if (ml && (match = ml.match(MEMOLIMIT_PATTERN))) {
            data.memorylimit = `${match[1]} ${match[2]}`;
          }
          let rs = getMetadata(header.eq(7));
          if (rs) {
            data.source = rs;
          }
          let description = $('#problem-body');
          description.find('pre').each((i, item) => {
            item = $(item);
            let data = item.html();
            data = data.replace(/\r/g, '');
            data = data.replace(/\n/g, '<br>');
            data = data.replace(/^(?:<br>)*/g, '');
            data = data.replace(/(?:<br>)*$/g, '');
            data = data.replace(/<strong>\s*<br>/, '<strong>');
            item.html(data);
          });
          data.html = tmpl({description: description.html()})
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
        $('table.problems tbody').children().each((i, elem) => {
          try {
            elem = $(elem).children().eq(1).find('a');
            let id = elem.attr('href').match(PROBLEM_ID_PATTERN)[1];
            let name = elem.text();
            if (id && name) {
              problems.push({
                id: id,
                name: name,
                oj: TYPE
              });
            }
          } catch (err) {}
        });
        return callback(null, problems);
      });
    }

    function reduceVolumes(problems, volume, callback) {
      async.waterfall([
        (next) => {
          let url = util.format(PROBLEMS_PATH_UNF, volume, 0);
          client.get(url, next);
        },
        (res, html, next) => {
          html = html || '';
          let problemsHref = [];
          let lastPage = 0;
          try {
            let $ = cheerio.load(html);
            let elem = $('ul.pagination li:last-child a').attr('href');
            lastPage = parseInt(elem.match(LAST_PAGE_PATTERN)[1]);
          } catch (err) {}
          let idx = 0;
          while (idx <= lastPage) {
            let url = util.format(PROBLEMS_PATH_UNF, volume, idx);
            problemsHref.push(url);
            idx += maxPerPage;
          }
          return async.reduce(problemsHref, problems, reduceProblems, next);
        }
      ], callback);
    }

    obj.fetchProblems = (callback) => {
      async.reduce(VOLUMES, [], reduceVolumes, callback);
    }
  })(AdapterSPOJ);

  return AdapterSPOJ;
})(Adapter);
