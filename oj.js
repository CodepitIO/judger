const assert = require('chai').assert,
      async = require('async'),
      _ = require('underscore');

const Adapter = require('./adapters/adapter'),
      config = require('./config/defaults'),
      Submission = require('./models/submission'),
      errors = require('./utils/errors'),
      submissionUtils = require('./utils/submissionUtils');

// Each OnlineJudge instance will have its own queue for sending submissions.
function OnlineJudge(type) {
  this.type = type;

  var CONFIG = config.oj[this.type];
  var adapters = [];
  var curAdapter = -1;

  var getNext = function() {
    // This should always be true
    // TODO log it properly
    assert(adapters.length > 0);
    curAdapter = (curAdapter+1) % adapters.length;
    return adapters[curAdapter];
  }

  var sendQueue = async.queue(function(submission, callback) {
    var adapter = getNext();
    adapter.send(submission, function(err, id) {
      if (err || !id) {
        return submissionUtils.handleSubmissionErrors(err, submission, callback);
      }
      async.waterfall([
        function(next) {
          Submission.count({oj_id: id}).exec(next);
        },
        function(count, next) {
          if (count > 0) return next(errors.DuplicateOnlineJudgeID);
          var origSubmission = submission.originalId;
          origSubmission.oj_id = id;
          origSubmission.verdict = -1;
          origSubmission.save(next);
        }
      ], function(err, result) {
        if (err) {
          return submissionUtils.handleSubmissionErrors(null, submission, callback);
        }
        console.log('Submitted to', submission.problemOj, 'with id', id);
        adapter.events.emit('submission', submission, id, callback);
      });
    });
  }, CONFIG.MAX_PENDING_SUBMISSIONS || 6);

  this.send = function(submission, callback) {
    sendQueue.push(submission, callback);
  }

  this.add = function(acct) {
    adapters.push(Adapter.create(acct));
  }
}

module.exports = OnlineJudge;