'use strict';

const kue   = require('kue')

const JUDGE     = require('../../common/constants').JUDGE,
      Publisher = require('./publisher')

// --- SUBMISSION QUEUE ---

var SubmissionQueue = kue.createQueue({
  redis: { host: 'redis' },
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

exports.SubmissionQueue = SubmissionQueue
