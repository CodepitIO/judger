var events = require('events');
var async = require('async');
var PendingSubmission = require('./models/pending_submission');

module.exports = (function(app) {
  this.app = app;

  var queue = async.queue(function (sub, callback) {
    var adapter = sub.curAcct.adapter;
    console.log('Sending code..');
    adapter.send(sub.problemId, sub.code, sub.language, function(e, mustLogin) {
      if (e) {
        if (!mustLogin) {
          return callback(e, false);
        } else {
          console.log('Not logged. Logging in..');
          adapter.login(function(e) {
            if (e) {
              console.log('Something wrong with logon :(');
              return callback(e, false);
            }
            console.log('Logged!');
            return callback(null, true);
          });
        }
      } else {
        console.log('Sent code!');
        return callback(null, false);
      }
    });
  }, 5);

  queue.drain = function() {
    console.log('all items have been processed');
  }

  function SubmissionEvent(submission) {
    this.id = submission._id;
    this.code = submission.code;
    this.language = submission.language;
    this.problemId = submission.problemId;
    this.type = submission.problemOj;
    this.curAcct = app.getNext(this.type);
    var that = this;

    try {
      var queueCb = function(e, retry) {
        if (retry) {
          queue.push(that, queueCb);
        }
      }

      queue.push(this, queueCb);
    } catch (err) {
      console.log(err);
    }
  }

  function cls(pending) {
    this.runSubmit = function(callback) {
      try {
        setInterval(function() {
          PendingSubmission
          .find()
          .exec()
          .then(function(submissions) {
            for (var i in submissions) {
              if (!pending[submissions[i]._id]) {
                pending[submissions[i]._id] = new SubmissionEvent(submissions[i]);
              }
            }
          });
        }, 1000);
      } catch (err) {
        console.log(err);
      }
    }
  }
  return cls;
});