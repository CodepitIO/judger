var Submission = require('./models/submission');
var PendingSubmission = require('./models/pending_submission');
var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId;;
var db = require('./config/db');
mongoose.connect(db.url);

/*
var pendingSubmissionSchema = mongoose.Schema({
  problemId: String,
  problemOj: String,
  code: String,
  language: String,
  originalId: {type: ObjectId, ref: 'Submission'},
  submitAttempts: {type: Number, default: 0},
  judgeAttempts: {type: Number, default: 0}
});
*/

Submission.find({contest: ObjectId('55f86bd375f76b7763765272')}).populate('problem').exec(function (err, results) {
  for (var i = 0; i < results.length; i++) {
    var submission = results[i];
    submission.verdict = -1;
    submission.oj_id = -1;
    submission.save(function(err, submission) {
      var psub = new PendingSubmission({
	problemId: submission.problem.id,
	problemOj: submission.problem.oj,
	code: submission.code,
	language: submission.language,
	originalId: submission._id,
      });
      psub.save();
    });
  }
});
