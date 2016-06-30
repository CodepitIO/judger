const kue   = require('kue'),
      async = require('async'),
      _     = require('lodash'),
      util  = require('util')

const Redis       = require('./dbs').redisClient,
      Defaults    = require('../config/defaults'),
      Submission  = require('../models/submission')

function updateScoreboard(s, callback) {
  let timestamp = new Date(s.date).getTime()
  let status = Defaults.scoreboardStatusName[Defaults.getScoreboardStatus(s.verdict)]

  let pendingSortedSetKey = `${s.contest}:PENDING`
  let accTimestampKey = `${s.contest}:${s.rep}:${s.problem}:ACC_TIMESTAMP`

  let sortedSetKey = util.format(`${s.contest}:%s`, status)
  let sortedSetValue = `${s.rep},${s.problem},${status},${timestamp}`

  async.waterfall([
    (next) => {
      Redis.zremrangebyscore(pendingSortedSetKey, timestamp, timestamp, next)
    },
    (cnt, next) => {
      if (status === 'FAIL') return callback()
      Redis.get(accTimestampKey, next)
    },
    (accTimestamp, next) => {
      if (accTimestamp && accTimestamp <= timestamp) return callback()
      if (status === 'ACCEPTED') {
        return Redis.set(accTimestampKey, timestamp, next)
      }
      next(null,0)
    },
    (ok, next) => {
      Redis.zadd(sortedSetKey, timestamp, sortedSetValue, next)
    }
  ], callback)
}

function updateSubmission(queueId, data) {
  async.waterfall([
    async.apply(kue.Job.get, queueId),
    (job, next) => {
      Submission.findById(job.data.id, next);
    },
    (submission, next) => {
      if (!submission) return next(new Error())
      if (submission.verdict > 0 && submission.verdict < 12) return next()
      for (var i in data) submission[i] = data[i]
      submission.save(next)
    },
    (submission, cnt, next) => {
      updateScoreboard(submission, next)
    }
  ], (err) => {
    // TODO: log to winston
  });
}

exports.updateSubmission = updateSubmission;
exports.updateScoreboard = updateScoreboard;
