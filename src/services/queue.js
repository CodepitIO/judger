'use strict';

const kue   = require('kue')

const SubmissionStatus  = require('../config/defaults').submissionStatus,
      Publisher         = require('./publisher'),
      DownloadFile      = require('../utils/util').downloadFile

// --- SUBMISSION QUEUE ---

var SubmissionQueue = kue.createQueue({
  redis: { host: 'redis' },
  jobEvents: false,
});

SubmissionQueue.on('job progress', (id, progress, data) => {
  Publisher.updateSubmission(id, data);
});

SubmissionQueue.on('job failed', (id, err) => {
  Publisher.updateSubmission(id, { oj_id: -1, verdict: SubmissionStatus.SUBMISSION_ERROR});
});

SubmissionQueue.watchStuckJobs(60 * 1000);

exports.SubmissionQueue = SubmissionQueue
