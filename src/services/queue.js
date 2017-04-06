'use strict';

const kue   = require('kue')

const SubmissionStatus  = require('../../common/constants').JUDGE.STATUS,
      Publisher         = require('./publisher')

// --- SUBMISSION QUEUE ---

var SubmissionQueue = kue.createQueue({
  redis: { host: 'redis' },
  jobEvents: false,
});

SubmissionQueue.on('job progress', (id, progress, data) => {
  Publisher.updateSubmission(id, data);
});

SubmissionQueue.on('job failed', (id, err) => {
  console.log(id, err);
  Publisher.updateSubmission(id, { oj_id: -1, verdict: SubmissionStatus.SUBMISSION_ERROR});
});

SubmissionQueue.watchStuckJobs(60 * 1000);

exports.SubmissionQueue = SubmissionQueue
