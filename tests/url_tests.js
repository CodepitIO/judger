'use strict';

const path    = require('path'),
      async   = require('async'),
      url     = require('url'),
      util    = require('util'),
      _       = require('lodash');

const RequestClient = require('../src/utils/requestClient'),
      Problem       = require('../src/models/problem'),
      Utils         = require('../src/utils/util')

function OjURLsTester(oj) {
  const SAMPLE_SIZE = 5000;
  const Config = require(`../src/adapters/${oj}/config`);
  const client = new RequestClient(Config.url);

  this.fetchProblemURLs = function(problem, callback) {
    console.log(problem.id);
    let urlPath = Config.getProblemPath(problem.id);
    client.get(urlPath, (err, res, html) => {
      if (err) console.log(err);
      if (err) return callback();
      Utils.adjustImgSrcs(html, problem, Config.url + urlPath, callback);
    });
  };

  this.fetchOjURLs = function(callback) {
    Problem.find({oj: oj}, (err, problems) => {
      let problemsTasks = _.chain(problems)
        .pickBy((o) => !o.isPdf)
        .sampleSize(SAMPLE_SIZE)
        .map((obj) => async.apply(this.fetchProblemURLs, obj))
        .value();
      console.log('> ', problemsTasks.length)
      async.parallelLimit(problemsTasks, 10, callback);
    })
  };
}


// toj timus uva la uri spoj spojbr codechef cf
function test() {
  let tester = new OjURLsTester('poj');
  tester.fetchOjURLs(() => {});
}

module.exports = test
