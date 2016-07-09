'use strict';

const async       = require('async');

const Dbs     = require('./src/services/dbs'),
      Judger  = require('./src/services/judger'),
      Fetcher = require('./src/services/fetcher');

if (process.env.NODE_ENV === 'development') {

}

function start() {
  async.waterfall([
    Judger.start,
    Fetcher.start,
  ], (err) => {
    if (err) {
      console.log(err);
    }
  });
}

start();
