'use strict';

const fs    = require('fs'),
      path  = require('path'),
      async = require('async');

const Errors  = require('../../common/errors'),
      Utils   = require('../../common/lib/utils');

const SubmissionStatus  = require('../../common/constants').JUDGE.STATUS;

module.exports = (function() {
  // constructor
  function Adapter(acct) {
    const Config = Utils.getOJConfig(acct.getType());

    let lastSubmission = 0;
    let judgeSet = {};
    let judgeCount = 0;

    this.addSubmissionHandler = (submission, progress, callback) => {
      judgeCount++;
      judgeSet[submission.oj_id] = {
        submission: submission,
        progress: progress,
        callback: callback
      };
    }
    this.removeSubmissionHandler = (submission) => {
      judgeCount--;
      delete judgeSet[submission.oj_id];
    }

    this.login = (callback) => {
      async.retry({times: 5, interval: 2000}, this._login, (err) => {
        if (err) {
          console.log(`Unable to log to ${acct.getType()} with account ${acct.getUser()}.`);
        } else {
          console.log(`Logged in on ${acct.getType()} with account ${acct.getUser()}.`);
        }
        return callback && callback();
      });
    }

    this.start = () => {
      async.forever(
        (next) => {
          if (judgeCount === 0) return setTimeout(next, 1000);
          this._judge(judgeSet, () => {
            for (let id in judgeSet) {
              let verdict = judgeSet[id].verdict;
              let submission = judgeSet[id].submission;
              verdict = Utils.getVerdict(acct.getType(), verdict);
              if (verdict) {
                if (submission.verdict !== verdict && verdict !== SubmissionStatus.SUBMISSION_ERROR) {
                  submission.verdict = verdict;
                  judgeSet[id].progress({verdict: verdict});
                }
                if (verdict > 0) {
                  let err = null;
                  if (verdict === SubmissionStatus.SUBMISSION_ERROR) {
                    err = Errors.SubmissionFail;
                  }
                  judgeSet[id].callback(err);
                }
              }
            }
            return setTimeout(next, 1000);
          });
        },
        (err) => {}
      );
    }

    let sendQueue = async.queue((submission, callback) => {
      if (!submission || !submission.language) {
        return callback(Errors.InternalError)
      }
      let language = Config.submitLang[submission.language];
      if (!language) return callback(Errors.InternalError);
      let code = Utils.commentCode(submission.code, submission.language);
      let data = {
        language: language,
        code: code,
        // if substitute id is set, give preference to it
        problemId: submission.problem.sid || submission.problem.id,
      };
      let interval = Config.intervalPerAdapter || 0;
      let currentTime = (new Date()).getTime();
      let waitTime = Math.max(0, interval - (currentTime - lastSubmission));
      lastSubmission = currentTime + waitTime;
      setTimeout(() => {
        this._send(data, callback);
      }, waitTime);
    }, 1);
    this.send = sendQueue.push;
  }

  // public static methods
  Adapter.create = (acct) => {
    let clsFn = require(`./${acct.type}/service`);
    if (clsFn) return new clsFn(acct);
    return null;
  };

  return Adapter;
})();
