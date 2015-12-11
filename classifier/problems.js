'use strict';

const async = require('async'),
      rest = require('restler'),
      _ = require('underscore');

const CF_HOST = 'codeforces.com',
      PROBLEMSET_API = '/api/problemset.problems',
      CONTESTS_API = '/api/contest.list',
      CONTEST_STANDINGS_API = '/api/contest.standings',
      USERSTATUS_API = '/api/user.status';

const ROUND_REGEX = /Codeforces.*Round\s*#([0-9]+)/,
      DIV_REGEX = /Div.*([12])/;

const ROWS_PER_CONTEST = 10000,
      FORMULA_THRESHOLD = 80,
      FORMULA_CONST = Math.log(0.1) * 100.0 / FORMULA_THRESHOLD;

const mongoose = require('mongoose'),
      db = require('../config/db'),
      Problem = require('../models/problem');
mongoose.connect(db.url);

var contests = {},
    problems = {};

var getContests = function(callback) {
  rest.get('http://' + CF_HOST + CONTESTS_API).on('complete', function(result) {
    if (result instanceof Error || result.status !== 'OK') {
      return callback(result);
    } else {
      async.map(result.result, function(obj, cb) {
        var nObj = null;
        if (obj.phase === 'FINISHED') {
          var round = obj.name.match(ROUND_REGEX);
          if (round && round.length >= 2) round = '#' + round[1];
          else round = null;
          var m = obj.name.match(DIV_REGEX);
          var div = null;
          if (m && m.length >= 2) div = m[1];
          nObj = {
            id: obj.id,
            div: div,
            round: round
          };
        }
        return cb(null, nObj);
      }, function(err, results) {
        for (var i = 0; i < results.length; i++) {
          if (!results[i]) continue;
          contests[results[i].id] = {
            problems: [],
            div: results[i].div,
            round: results[i].round,
          }
        }
        return callback(null);
      });
    }
  });
}

var cfProblems = {},
    fetchUser = {};
var getContestStandings = function(id, callback) {
  rest.get('http://' + CF_HOST + CONTEST_STANDINGS_API, {
    query: {
      contestId: id,
      from: 1,
      count: ROWS_PER_CONTEST,
      showUnofficial: true,
    }
  }).on('complete', function(result) {
    console.log('>', id);
    if (result instanceof Error || result.status !== 'OK') {
      console.log('Fail ', id);
      return callback();
    } else {
      var problems = result.result.problems;
      var rows = result.result.rows;

      var registrants = rows.length;

      for (var i = 0; i < problems.length; i++) {
        contests[id].problems.push({
          solvedBy: 0,
          registrants: registrants,
          pid: id + String.fromCharCode(65+i),
        });
      }

      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].party.teamId) {
          var user = rows[i].party.members[0];
          for (var j = 0; j < rows[i].problemResults.length; j++) {
            if(rows[i].problemResults[j].points > 0) {
              contests[id].problems[j].solvedBy++;
            }
          }
        }
      }
      return callback();
    }
  });
}


var getProblems = function(callback) {
  rest.get('http://' + CF_HOST + PROBLEMSET_API).on('complete', function(result) {
    if (result instanceof Error || result.status !== 'OK') {
      return callback(result, 0);
    } else {
      var tmpProblems = result.result.problems;
      async.forEachOf(tmpProblems, function(obj, _, cb) {
        if (obj.type === 'PROGRAMMING') {
          problems[obj.contestId + obj.index] = {
            tags: obj.tags,
            realId: obj.contestId + obj.index,
            level: 5,
          };
        }
        cb();
      }, callback);
    }
  });
}



var fn = function() {}

function getLevel(x,y) { return Math.exp(FORMULA_CONST * x / y) * 10; }

async.waterfall([
  getProblems,
  getContests,
  function(callback) {
    var q = async.queue(function (id, callback) {
        async.retry({times: 0, interval: 2000}, getContestStandings.bind(null,id), callback);
    }, 3);
    for (var id in contests) {
      q.push(id, fn);
    }
    q.drain = callback;
  },
  function(callback) {
    var _contests = {};
    for (var id in contests) {
      var obj = contests[id];
      if (obj.round && obj.div === '2') {
        _contests[obj.round] = {
          problems: [],
          shift: 0,
        };
        for (var j = 0; j < obj.problems.length; j++) {
          var pid = obj.problems[j].pid;
          if (!problems[pid]) _contests[obj.round].shift++;
          else problems[pid].realId = pid;
          _contests[obj.round].problems.push({
            solvedBy: obj.problems[j].solvedBy,
            registrants: obj.problems[j].registrants,
            pid: obj.problems[j].pid,
          });
        }
      }
    }
    callback(null, _contests);
  },
  function(_contests, callback) {
    for (var id in contests) {
      var obj = contests[id];
      if (obj.round && obj.div === '2') continue;
      if (!obj.round) obj.round = id;
      _contests[obj.round] = _contests[obj.round] || {problems: []};
      var shift = _contests[obj.round].shift;
      var unshift = _contests[obj.round].problems.length - shift;
      var mult = 0.05;
      var registrants = 0;
      for (var j = 0; j < unshift; j++) {
        registrants = _contests[obj.round].problems[j].registrants;
        _contests[obj.round].problems[j].solvedBy += registrants;
        _contests[obj.round].problems[j].registrants += registrants;
      }
      for (var j = 0; j < obj.problems.length; j++) {
        if (j < shift) {
          var x = obj.problems[j].solvedBy;
          var ratio = registrants / obj.problems[j].registrants;
          _contests[obj.round].problems[j+unshift].solvedBy += x * ratio;
          _contests[obj.round].problems[j+unshift].registrants = 2 * registrants;
          var pid = _contests[obj.round].problems[j+unshift].pid;
          problems[pid] = {realId: obj.problems[j].pid};
          _contests[obj.round].problems[j+unshift].pid = obj.problems[j].pid;
          problems[obj.problems[j].pid].realId = obj.problems[j].pid;
        } else {
          var _solvedBy = obj.problems[j].solvedBy;
          var _registrants = obj.problems[j].registrants;
          if (unshift > 0) {
            _registrants = 2 * registrants;
            _solvedBy += mult * registrants;
            mult *= 0.7;
          }
          if (problems[obj.problems[j].pid]) {
            problems[obj.problems[j].pid].realId = obj.problems[j].pid;
          }
          _contests[obj.round].problems.push({
            solvedBy: _solvedBy,
            registrants: _registrants,
            pid: obj.problems[j].pid,
          });
        }
      }
    }
    contests = _contests;
    for (var id in contests) {
      for (var j = 0; j < contests[id].problems.length; j++) {
        var x = contests[id].problems[j].solvedBy;
        var y = contests[id].problems[j].registrants;
        if (problems[contests[id].problems[j].pid]) {
          problems[contests[id].problems[j].pid].level = getLevel(x,y);
        }
      }
    }
    async.forEachOf(problems, function(obj, id, cb) {
      Problem.findOne({oj: 'cf', id: obj.realId}).exec(function(err, res) {
        if (res) {
          if (obj.tags) res.tags = obj.tags;
          if (obj.level) res.level = obj.level;
          if (id != obj.realId) res.id2 = id;
          console.log(obj.realId);
          res.save(cb);
        } else {
          //console.log('> ', obj);
          return cb();
        }
      });
    }, callback);
  },
], function() {
  console.log('DONE!');
});
//*/
