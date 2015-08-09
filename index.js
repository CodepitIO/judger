const async = require('async');
const fs = require('fs');
const path = require('path');
var mongoose = require('mongoose');

var db = require('./config/db');
mongoose.connect(db.url);

const App = require('./app');
var app = new App();

var pendingSubmissions = {};
var Submitter = require('./submitter')(app);
var submitter = new Submitter(pendingSubmissions);

var arguments = process.argv.slice(2);

switch (arguments[0]) {
  // add <oj> <username> <password>
  case 'add':
    app.add(arguments[1], arguments[2], arguments[3]);
    process.exit();
  // remove <oj> <username>
  case 'remove':
    app.remove(arguments[1], arguments[2]);
    process.exit();
  case 'run':
  default:
    submitter.runSubmit();
}
