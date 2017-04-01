'use strict';

const cheerio = require('cheerio'),
      assert  = require('assert'),
      async   = require('async'),
      path    = require('path'),
      util    = require('util');

const Adapter       = require('../adapter'),
      Config        = require('./config'),
      Errors        = require('../../utils/errors'),
      RequestClient = require('../../utils/requestClient'),
      Util          = require('../../utils/util');

const HOST             = "acm.timus.ru",
      SUBMIT_PAGE_PATH = "/submit.aspx",
      SUBMIT_PATH      = "/submit.aspx?space=1",
      AUTHOR_UNF_PATH  = "/status.aspx?space=1&count=50&author=%s";

const SUBMIT_FORM_PATTERN = /<form([^>]+?)>((?:.|\n)*?)<\/form>/i,
      INPUT_PATTERN       = /<input([^>]+?)\/?>/gi,
      INVALID_ACC_PATTERN = /Invalid\s+JUDGE_ID/i,
      FAST_SUB_PATTERN    = /between\s+submissions/i;

const TYPE = path.basename(__dirname);

module.exports = (function(parentCls){

  function AdapterTIMUS(acct) {
    parentCls.call(this, acct);

    const client = new RequestClient('http', HOST);

    const AUTHOR_PATH = util.format(AUTHOR_UNF_PATH, acct.getUser());

    function login(callback) {
      return callback();
    }

    this._login = login;

    function getSubmissionID(callback) {
      client.get(AUTHOR_PATH, (err, res, html) => {
        if (err) {
          return callback(err);
        }
        let id;
        try {
          let $ = cheerio.load(html);
          id = $('.id a').html();
          assert(id && id.length >= 6);
        } catch (e) {
          return callback(Errors.SubmissionFail);
        }
        return callback(null, id);
      });
    }

    function send(submission, callback) {
      let data = {
        Action: 'submit',
        SpaceID: '1',
        JudgeID: acct.getPass(),
        Language: submission.language,
        ProblemNum: submission.problemId,
        Source: submission.code,
        SourceFile: ''
      };
      let opts = {
        followAllRedirects: false,
        headers: {
          Referer: 'http://' + HOST + SUBMIT_PAGE_PATH,
        },
      };
      client.postMultipart(SUBMIT_PATH, data, opts, (err, res, html) => {
        if (err) {
          return callback(err);
        }
        if (html.match(INVALID_ACC_PATTERN)) {
          return callback(Errors.LoginFail);
        }
        if (html.match(FAST_SUB_PATTERN)) {
          return callback(Errors.SubmissionFail);
        }
        return getSubmissionID(callback);
      });
    };

    this._send = send;

    function judge(judgeSet, callback) {
      client.get(AUTHOR_PATH, (err, res, html) => {
        if (err) {
          return callback();
        }
        let $ = cheerio.load(html);
        for (let id in judgeSet) {
          let data = null;
          try {
            data = $('a:contains("' + id + '")');
            data = data.parent().nextAll().eq(4);
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
    const PROBLEMS_PATH = "/problemset.aspx?space=1&page=all";

    const client = new RequestClient('http', HOST);

    const TIMELIMIT_PATTERN = /time\s*limit:\s*([\d.,]+)\s*\w/i;
    const MEMOLIMIT_PATTERN = /memory\s*limit:\s*([\d\w\s]+)/i;

    obj.import = (problem, callback) => {
      let url = Config.getProblemPath(problem.id);
      client.get(url, (err, res, html) => {
        if (err) return callback(err);
        let data = {};
        try {
          html = html.replace(/(<)([^a-zA-Z\s\/\\!])/g, '&lt;$2');
          let $ = cheerio.load(html);
          Util.adjustImgSrcs($, url);
          $('a').each((i, elem) => {
            elem = $(elem);
            let href = elem.attr('href')
            if (href && href[0] === '/') {
              elem.attr('href', '//' + HOST + href)
            }
          });
          let header = $('.problem_limits');
          let match;
          if (match = header.html().match(TIMELIMIT_PATTERN)) {
            data.timelimit = parseFloat(match[1]);
          }
          if (match = header.html().match(MEMOLIMIT_PATTERN)) {
            data.memorylimit = match[1];
          }
          let source = $('.problem_source');
          source.find('b').remove();
          if (source && source.text()) data.source = source.text();
          source.remove();
          data.html = '<div class="timus-problem">' + $('#problem_text').html() + '</div>';
        } catch (err) {
          return callback(err);
        }
        return callback(null, data);
      });
    }

    obj.fetchProblems = (callback) => {
      client.get(PROBLEMS_PATH, (err, res, html) => {
        html = html || '';
        let problems = [];
        let $ = cheerio.load(html);
        $('tr.content').nextAll().each((i, elem) => {
          elem = $(elem).children();
          let id = elem.eq(1).html();
          let name = elem.eq(2).text();
          if (id && name) {
            problems.push({
              id: id,
              name: name,
              oj: TYPE
            });
          }
        });
        return callback(null, problems);
      });
    }
  })(AdapterTIMUS);

  return AdapterTIMUS;
})(Adapter);
