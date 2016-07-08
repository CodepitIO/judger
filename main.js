'use strict';

const async       = require('async');

const Dbs     = require('./src/services/dbs'),
      Judger  = require('./src/services/judger'),
      Fetcher = require('./src/services/fetcher');

if (process.env.NODE_ENV === 'development') {
  /*
  const Submission = require('./src/models/submission')
  const Contest = require('./src/models/contest')
  const Publisher = require('./src/services/publisher')
  Submission.find().sort({date: 1}).exec((err, submissions) => {
    console.log(err)
    let i = 0
    async.eachSeries(submissions, (s, callback) => {
      console.log(++i)
      async.waterfall([
        (next) => {
          if (s.rep) return next(null, s, false)
          let contestId = s.contest
          Contest.findById(contestId, (err, contest) => {
            if (!contest) return next(null, s, false)
            s.rep = contest.getUserRepresentative(s.contestant)
            s.save(next)
          })
        },
        (s, _i, next) => {
          if (!s.rep) return next()
          console.log('<<updating>>')
          Publisher.updateScoreboard(s, next)
        }
      ], (err) => {
        if (err) console.log(s, err)
        return callback()
      })
    })
  });
  //*/
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
