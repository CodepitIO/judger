"use strict";

const async = require("async");

const Adapter = require("../adapters/adapter"),
  Submission = require("../../common/models/submission"),
  Errors = require("../../common/errors"),
  SubmissionQueue = require("./queue").SubmissionQueue,
  Utils = require("../../common/lib/utils"),
  Publisher = require("./publisher");

const SubmissionStatus = require("../../common/constants").JUDGE.STATUS;

module.exports = (function () {
  function OnlineJudge(type) {
    this.type = type;

    const Config = Utils.getOJConfig(type);
    let adapters = [];
    let curAdapter = -1;

    function getNext() {
      if (adapters.length === 0) return null;
      curAdapter = (curAdapter + 1) % adapters.length;
      return adapters[curAdapter];
    }

    function handleSubmission(job, done) {
      job.progress = job.progress.bind(job, 0, 1);
      job.progress({ oj_id: -1, verdict: SubmissionStatus.PENDING });

      let adapter = getNext();
      let submission;
      let judging = false;

      async.waterfall(
        [
          (next) => {
            Submission.findById(job.data.id).populate("problem").exec(next);
          },
          (_submission, next) => {
            submission = _submission;
            Publisher.startSubmission(submission, next);
          },
          (_cnt, next) => {
            adapter.send(submission, next);
          },
          (_ojId, next) => {
            if (!_ojId) return next(Errors.SubmissionFail);
            submission.oj_id = _ojId;
            Submission.countDocuments({ oj_id: _ojId }, next);
          },
          (count, next) => {
            if (count > 0) return next(Errors.DuplicateOnlineJudgeID);
            submission.verdict = SubmissionStatus.ON_JUDGE_QUEUE;
            job.progress({
              oj_id: submission.oj_id,
              verdict: SubmissionStatus.ON_JUDGE_QUEUE,
            });
            async.timeout((callback) => {
              judging = true;
              adapter.addSubmissionHandler(submission, job.progress, callback);
            }, Config.submissionTTL || 30 * 60 * 1000)(next);
          },
        ],
        (err) => {
          if (judging) {
            adapter.removeSubmissionHandler(submission);
          }
          if (err === Errors.InternalError) {
            job.progress({
              oj_id: -1,
              verdict: SubmissionStatus.INTERNAL_ERROR,
            });
            return done();
          } else if (err === Errors.UnretriableError) {
            job.progress({
              oj_id: -1,
              verdict: SubmissionStatus.SUBMISSION_ERROR,
            });
            return done();
          } else if (err) {
            return done(err);
          }
          return done();
        }
      );
    }

    this.login = () => {
      for (let i in adapters) {
        adapters[i].login();
      }
    };

    this.start = () => {
      if (adapters.length > 0) {
        for (let i in adapters) {
          adapters[i].start();
        }
        SubmissionQueue.process(
          `submission:${type}`,
          Config.maxPendingSubmissions || 6,
          handleSubmission
        );
      }
    };

    this.addAccount = (acct) => {
      let newAdapter = Adapter.create(acct);
      if (newAdapter) adapters.push(newAdapter);
    };
  }

  return OnlineJudge;
})();
