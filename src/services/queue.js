'use strict';

const kue   = require('kue');

const JUDGE     = require('../../common/constants').JUDGE,
      Dbs     = require('./dbs'),
      Publisher = require('./publisher');

// --- SUBMISSION QUEUE ---

var SubmissionQueue = kue.createQueue({
  redis: {
    createClientFactory: Dbs.createRedisClient,
  },
  jobEvents: false,
});

SubmissionQueue.on('job progress', (id, progress, data) => {
  console.log(id, data.oj_id, JUDGE.VERDICT[data.verdict]);
  Publisher.updateSubmission(id, data);
});

SubmissionQueue.on('job failed', (id, err) => {
  console.log(id, err);
  Publisher.updateSubmission(id, { oj_id: -1, verdict: JUDGE.STATUS.SUBMISSION_ERROR});
});

SubmissionQueue.watchStuckJobs(60 * 1000);

SubmissionQueue.setMaxListeners(500);

exports.SubmissionQueue = SubmissionQueue;

exports.pushSubmission = (oj, s, callback) => {
  let job = SubmissionQueue.create(`submission:${oj}`, { id: s._id });
  job.attempts(7);
  job.backoff({ delay: 60 * 1000, type: 'exponential' });
  job.save(callback);
};
