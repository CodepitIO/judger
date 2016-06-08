'use strict';

const kue              = require('kue'),
      async            = require('async'),
      Submission       = require('../models/submission'),
      SubmissionStatus = require('../config/defaults').submissionStatus,
      socket           = require('./socket');

var Queue = kue.createQueue({
  redis: { host: 'redis' },
  jobEvents: false,
});

function updateSubmission(queueId, data) {
  console.log(data);
  async.waterfall([
    async.apply(kue.Job.get, queueId),
    (job, next) => {
      Submission.findById(job.data.id, next);
    },
    (submission, next) => {
      if (submission.verdict > 0 && submission.verdict < 12) {
        return next();
      }
      for (var i in data) {
        submission[i] = data[i];
      }
      socket.broadcast(submission)
      return submission.save(next);
    }
  ]);
}

Queue.on('job progress', (id, progress, data) => {
  updateSubmission(id, data);
});

Queue.on('job failed', (id, err) => {
  updateSubmission(id, { oj_id: -1, verdict: SubmissionStatus.SUBMISSION_ERROR});
});

Queue.watchStuckJobs(60 * 1000);

module.exports = Queue;
