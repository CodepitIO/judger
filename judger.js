'use strict';

const OjAccount = require('./models/oj_account');
const OnlineJudge = require('./oj');
const Submitter = require('./submitter');
const fs = require('fs');

// Connect to the database
var mongoose = require('mongoose');
var db = require('./config/db');
mongoose.connect(db.url);

// FOR IMPORTED PROBLEMS HTML
var problemsDir = 'problems';
if (!fs.existsSync(problemsDir)) {
  fs.mkdirSync(problemsDir, { mode: '0777' });
}

function loadAccounts(callback) {
  OjAccount.find().exec(function(err, accts) {
    var ojs = {};
    for (var i = 0; i < accts.length; i++) {
      accts[i].type = accts[i].type.toLowerCase();
      ojs[accts[i].type] = ojs[accts[i].type] || new OnlineJudge(accts[i].type);
      ojs[accts[i].type].add(accts[i]);
    }

    return callback(ojs);
  });
}

loadAccounts(function(ojs) {
  Submitter(ojs);
});