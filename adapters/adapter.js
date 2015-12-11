'use strict';

const fs = require('fs'),
      path = require('path'),
      async = require('async'),
      EventEmitter = require('events').EventEmitter,
      watch = require("watchjs").watch,
      util = require('util'),
      submissionUtils = require('../utils/submissionUtils');

const config = require('../config/defaults');

// Maps from typeName to class function
var subClasses = {}; // private static field
var normNames = {}; // normalize the type name

module.exports = (function() {
    // constructor
    function Adapter(acct) {
        var that = this;
        var CONFIG = config.oj[acct.type];
        
        this.send = function(submission, callback) {
            sendQueue.push(submission, callback);
        };

        this.judge = function() {
          async.whilst(
            function() { return submissions.judging; },
            function(callback) {
              setTimeout(that._judge.bind(null, submissions.map, callback), 3000);
            },
            function(err) {}
          );
        }

        var submissions = {
          count: 0,
          judging: false,
          map: {}
        };

        this.events = new EventEmitter();
        this.events.on('submission', function(submission, id, callback) {
          submissions.map[id] = {
            data: submission,
            callback: callback
          };
          submissions.count++;
        });
        this.events.on('verdict', function(id, verdict) {
          if (!submissions.map[id]) {
            // log error.. this should never happen
            console.log("Null reference to id " + id);
            return;
          }
          if (verdict === null || verdict === undefined ||
            CONFIG.verdictId[verdict] === undefined ||
            CONFIG.verdictId[verdict] === null) {
            // TODO every judge module should check if its loading the status
            // page correctly.
            return submissionUtils.handleJudgeErrors(
              null,
              submissions.map[id].data,
              submissions.map[id].callback
            );
          }

          verdict = CONFIG.verdictId[verdict];
      	  console.log(id, config.verdictName[verdict]);

          var submission = submissions.map[id].data;
          var origSubmission = submission.originalId;
          if (verdict == origSubmission) return;
          origSubmission.verdict = verdict;
          origSubmission.save(function() {
            if (verdict > 0) {
              var callback = submissions.map[id].callback;
              delete submissions.map[id];
              submissions.count--;
              submission.remove(callback);
            }
          });
        });

        watch(submissions, 'count', function() {
          if (submissions.count > 0 && !submissions.judging) {
            submissions.judging = true;
            that.judge();
          } else if (submissions.count === 0 && submissions.judging) {
            submissions.judging = false;
          }
        });

        // Last submission's Epoch time
        this.lastSubmission = 0;

        var sendQueue = async.queue(function(submission, callback) {
          var interval = CONFIG.intervalPerAdapter || 0;
          var wait = Math.max(0, interval - ((new Date()).getTime() - that.lastSubmission));
          that.lastSubmission = (new Date()).getTime() + wait;
          setTimeout(function() {
            that._send(
              submission.problemId,
              submission.code,
              submission.language,
              true /* try login in case submission fails */,
              callback
            );
          }, wait);
      }, CONFIG.submissionWorkersPerAdapter || 1);
    }

    Adapter.normalizeType = function(s) {
        return normNames[s.toLowerCase()];
    };

    // public static method
    Adapter.create = function(acct) {
        var clsFn = subClasses[acct.type];
        if (clsFn) return new clsFn(acct);
        return null;
    };

    return Adapter;
})();

/*
 * Auto load the subclasses
 */
(function(){
    var files = fs.readdirSync(__dirname);
    for (var i=0; i < files.length; i++)
    {
        var match = /^adapter(\w+)/i.exec(files[i]);
        if (!match) continue;
        var modName = match[1];
        var lower = modName.toLowerCase();
        normNames[lower] = modName;
        subClasses[lower] = require('./'+files[i]);
    }
})();
