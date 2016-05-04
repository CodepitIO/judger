'use strict';

const async       = require('async');

const Dbs     = require('./app/services/dbs'),
      Judger  = require('./app/services/judger'),
      Fetcher = require('./app/services/fetcher');

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
