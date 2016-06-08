'use strict';

const async   = require('async');

const Adapter           = require('../adapters/adapter'),
      Submission        = require('../models/submission'),
      Errors            = require('../utils/errors'),
      Defaults          = require('../config/defaults'),
      Queue             = require('./queue');

const SubmissionStatus  = Defaults.submissionStatus;

module.exports = (function() {
  function OnlineJudge(type) {
    const Settings = Defaults.oj[type];
    let adapters = [];
    let curAdapter = -1;

    function getNext() {
      curAdapter = (curAdapter+1) % adapters.length;
      return adapters[curAdapter];
    }

    function handleSubmission(job, done) {
      job.progress = job.progress.bind(job, 0, 1);
      job.progress({oj_id: -1, verdict: SubmissionStatus.PENDING});
      let adapter = getNext();
      let submission;
      let judging = false;

      async.waterfall([
        (next) => {
          Submission.findById(job.data.id).populate('problem').exec(next);
        },
        (_submission, next) => {
          submission = _submission;
          adapter.send(submission, next);
        },
        (_ojId, next) => {
          if (!_ojId) return next(Errors.SubmissionFail);
          submission.oj_id = _ojId;
          Submission.count({oj_id: _ojId}, next);
        },
        (count, next) => {
          if (count > 0) return next(Errors.DuplicateOnlineJudgeID);
          submission.verdict = SubmissionStatus.ON_JUDGE_QUEUE;
          job.progress({oj_id: submission.oj_id, verdict: SubmissionStatus.ON_JUDGE_QUEUE});
          async.timeout((callback) => {
            judging = true;
            adapter.addSubmissionHandler(submission, job.progress, callback);
          }, Settings.submissionTTL || 10 * 60 * 1000)(next);
        }
      ], (err) => {
        if (judging) {
          adapter.removeSubmissionHandler(submission);
        }
        if (err == Errors.InternalError) {
          job.progress({oj_id: -1, verdict: SubmissionStatus.INTERNAL_ERROR});
          return done();
        } else if (err) {
          return done(err);
        }
        return done();
      });
    }

    this.login = () => {
      for (let i in adapters) {
        adapters[i].login();
      }
    }

    this.start = () => {
      for (let i in adapters) {
        adapters[i].start();
      }
      Queue.process(
        `submission:${type}`,
        Settings.maxPendingSubmissions || 6,
        handleSubmission
      );
    }

    this.addAccount = (acct) => {
      adapters.push(Adapter.create(acct));
    }

    this.fetchProblems = Adapter.fetchProblems.bind(null, type);

    this.import = Adapter.import.bind(null, type);
  }

  return OnlineJudge;
})();
