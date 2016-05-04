'use strict';

const fs    = require('fs'),
      path  = require('path'),
      async = require('async'),
      util  = require('util'),
      _     = require('lodash');

const Defaults  = require('../config/defaults'),
      Errors    = require('../utils/errors');

const SubmissionStatus  = Defaults.submissionStatus;

// Maps from typeName to class function
let subClasses = {}; // private static field
let normNames = {}; // normalize the type name

module.exports = (function() {
  // constructor
  function Adapter(acct) {
    const Settings = Defaults.oj[acct.getType()];

    let lastSubmission = 0;
    let judgeSet = {};
    let judgeCount = 0;

    this.judge = (submission, progress, callback) => {
      judgeCount++;
      judgeSet[submission.oj_id] = {
        submission: submission,
        progress: progress,
        callback: callback
      };
    }
    this.stopJudge = (submission) => {
      judgeCount--;
      delete judgeSet[submission.oj_id];
    }

    this.start = () => {
      async.retry({times: 5, interval: 2000}, this._login, (err) => {
        if (err) {
          console.log(`Unable to log to ${acct.getType()} with account ${acct.getUser()}.`);
        }
      });
      async.forever(
        (next) => {
          if (judgeCount === 0) return setTimeout(next, 1000);
          this._judge(judgeSet, () => {
            for (let id in judgeSet) {
              let verdict = judgeSet[id].verdict;
              let submission = judgeSet[id].submission;
              if (verdict != null && Settings.verdictId[verdict] != null) {
                verdict = Settings.verdictId[verdict];
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
      let language = Settings.submitLang[submission.language];
      if (!language) {
        return callback(Errors.InternalError);
      }
      let code = submission.code + '\n// ' + (new Date()).getTime();
      let data = {
        language: language,
        code: code,
        problemId: submission.problem.id,
      };
      let interval = Settings.intervalPerAdapter || 0;
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
    let clsFn = subClasses[acct.type];
    if (clsFn) return new clsFn(acct);
    return null;
  };

  Adapter.fetchProblems = (type, callback) => {
    return subClasses[type].fetchProblems(callback);
  }

  (function (obj) {
    let importQueues = {};

    function getOrCreateQueue(type) {
      if (!importQueues[type]) {
        importQueues[type] = async.queue((problem, callback) => {
          if (subClasses[type].import) {
            return subClasses[type].import(problem, callback);
          }
          return async.setImmediate(callback);
        }, Defaults.oj[type].maxImportWorkers || 3);
      }
      return importQueues[type];
    }

    obj.import = (type, problem, callback) => {
      getOrCreateQueue(type).push(problem, callback);
    }
  })(Adapter);

  return Adapter;
})();

/*
 * Auto load the subclasses
 */
(function(){
  let files = fs.readdirSync(__dirname);
  for (let i=0; i < files.length; i++) {
    let match = /^adapter(\w+)/i.exec(files[i]);
    if (!match) continue;
    let modName = match[1];
    let lower = modName.toLowerCase();
    normNames[lower] = modName;
    subClasses[lower] = require('./'+files[i]);
  }
})();
