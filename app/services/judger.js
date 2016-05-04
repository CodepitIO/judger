'use strict';

const async       = require('async'),
      kue         = require('kue');

const OjAccount   = require('../models/oj_account'),
      OnlineJudge = require('./oj'),
      Queue       = require('./queue');

module.exports = (() => {
  let ojs = {};

  function reloadActiveTasks() {
    Queue.active((err, ids) => {
      ids.forEach((id) => {
        kue.Job.get(id, (err, job) => {
          job.inactive();
        });
      });
    });
  }

  function loadOnlineJudgeAccounts(callback) {
    OjAccount.find().exec((err, accts) => {
      for (var i = 0; i < accts.length; i++) {
        if (!ojs[accts[i].type]) {
          ojs[accts[i].type] = new OnlineJudge(accts[i].type);
        }
        ojs[accts[i].type].addAccount(accts[i]);
      }
      return callback();
    });
  }

  function startJudgers(callback) {
    for (var name in ojs) {
      ojs[name].start();
    }
    return callback();
  }

  this.start = (callback) => {
    reloadActiveTasks();
    async.series([
      loadOnlineJudgeAccounts,
      startJudgers,
    ], () => {
      return callback(null, ojs);
    });
  }

  return this;
})();
