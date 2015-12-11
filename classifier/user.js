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

const MAX_SOLVED_LENGTH = 60;
const MAX_GENERAL_SOLVED_LENGTH = 100;

var problems = {};

function getTagLevel(array) {
  array.sort(function(a,b) {
    return a.level - b.level;
  });
  // ignore first 25%
  var ini = Math.floor(array.length * 0.25);
  // if enough elements, ignore last 5%
  var fim = array.length;
  if (array.length > 60) fim = Math.floor(array.length * 0.95);

  var array2 = [];
  for (var i = ini; i < fim; i++) {
    array2.push(array[i]);
  }
  array = array2;
  array2 = null;

  var num = 0, den = 0;
  for (var i = 0; i < array.length; i++) {
    num += array[i].level * array[i].level * array[i].level;
    den += array[i].level * array[i].level;
  }
  return num / den;
}

var getSolvedProblems = function(user, callback) {
  rest.get('http://' + CF_HOST + USERSTATUS_API, {
    query: {
      handle: user
    }
  }).on('complete', function(result) {
    result = result.result;
    var hasSolved = {};
    var solved = {
      general: [],
    };
    for (var i = 0; i < result.length; i++) {
      if (result[i].author.teamId) {
        continue;
      }
      var problem = problems[result[i].problem.contestId + result[i].problem.index];
      if (problem) {
        var id = problem.id;
        if (result[i].verdict === 'OK' && !hasSolved[id]) {
          if (solved.general.length < MAX_GENERAL_SOLVED_LENGTH) {
            solved.general.push({id: id, level: problem.level});
          }
          for (var j = 0; j < result[i].problem.tags.length; j++) {
            var tag = result[i].problem.tags[j];
            solved[tag] = solved[tag] || [];
            if (solved[tag].length < MAX_SOLVED_LENGTH) {
              solved[tag].push({id: id, level: problem.level});
            }
          }
          hasSolved[id] = true;
        }
      }
    }
    var tagData = {};
    for (var i in solved) {
      tagData[i] = {
        level: getTagLevel(solved[i]),
        qnt: solved[i].length,
      }
    }
    console.log(tagData);
  });
}

async.waterfall([
  function(callback) {
    Problem.find({oj: 'cf'}).exec(callback);
  },
  function(res, callback) {
    for (var i = 0; i < res.length; i++) {
      problems[res[i].id] = res[i];
      if (res[i].id2)
        problems[res[i].id2] = res[i];
    }
    return getSolvedProblems('godely', callback);
  },
  function(callback) {

  },
], function() {

});