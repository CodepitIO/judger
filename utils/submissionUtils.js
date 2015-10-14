const async = require('async');
const errors = require('./errors');

function invalidateSubmission(submission, callback) {
  var origSubmission = submission.originalId;
  async.parallel([
    function(next) {
      submission.remove(next);
    },
    function(next) {
      origSubmission.oj_id = -1;
      origSubmission.verdict = 11;
      origSubmission.save(next);
    }
  ], callback);
}

function restSubmission(submission, callback) {
  var origSubmission = submission.originalId;
  async.parallel([
    function(next) {
      submission.remove(next);
    },
    function(next) {
      origSubmission.oj_id = -1;
      origSubmission.verdict = 12;
      // TODO set a retry interval to the future
      origSubmission.save(next);
    }
  ], callback);
}

function increaseSubmitAttempts(submission, callback) {
  submission.submitAttempts++;
  submission.save(callback);
}

module.exports = {
  handleSubmissionErrors: function(err, submission, callback) {
    if (err == errors.InvalidSubmission) {
      return invalidateSubmission(submission, callback);
    } else if (submission.submitAttempts >= 2) {
      return restSubmission(submission, callback);
    } else {
      return increaseSubmitAttempts(submission, callback);
    }
  },
  handleJudgeErrors: function(err, submission, callback) {
    if (submission.judgeAttempts >= 14) {
      return callback();
    } else {
      submission.judgeAttempts++;
    }
  }
}