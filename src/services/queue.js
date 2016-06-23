'use strict';

const kue   = require('kue')

const SubmissionStatus  = require('../config/defaults').submissionStatus,
      Publisher         = require('./publisher')

var Queue = kue.createQueue({
  redis: { host: 'redis' },
  jobEvents: false,
});

Queue.on('job progress', (id, progress, data) => {
  Publisher.updateSubmission(id, data);
});

Queue.on('job failed', (id, err) => {
  Publisher.updateSubmission(id, { oj_id: -1, verdict: SubmissionStatus.SUBMISSION_ERROR});
});

Queue.watchStuckJobs(60 * 1000);

module.exports = Queue;
