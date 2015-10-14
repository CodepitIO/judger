// app/models/problem.js
// load the things we need
const mongoose = require('mongoose'),
      _ = require('underscore'),
      fs = require('fs'),
      path = require('path'),
      _s = require('underscore.string');

const config = require('../config/defaults').oj;

const PROBLEMS_FOLDER = 'problems';
const ABS_PROBLEMS_FOLDER = path.join(__dirname, '..', PROBLEMS_FOLDER);

// define the schema for our user model
var problemSchema = mongoose.Schema({
  id: String,
  name: String,
  oj: String,
  url: String,
  fullName: String
});

// methods ======================
problemSchema.statics.createNew = function(pid, pname, poj, cb, html) {
  var schema = this;
  schema.count({
    id: pid,
    oj: poj
  }, function(err, count) {
    if (!err && count == 0) {
      pid = _s.trim(pid);
      pname = _s.trim(pname);
      pname = _s.unescapeHTML(pname);
      pname = pname.replace('&apos;', '\'');
      pname = pname.replace('&#x441;', 'c');
      var fn = '[' + config[poj].name + ' ' + pid + '] ' + pname;
      var newProblem = new schema({
        fullName: fn,
        id: pid,
        name: pname,
        oj: poj,
        url: config[poj].getUrl(pid)
      });
      console.log('Created problem ' + fn + '!');
      if (!html) newProblem.save(cb);
      else {
        newProblem.save(function(err, prob) {
          if (!fs.existsSync(PROBLEMS_FOLDER)){
            fs.mkdirSync(PROBLEMS_FOLDER);
          }
          fs.writeFileSync(path.join(ABS_PROBLEMS_FOLDER, prob._id + '.html'), html);
          prob.url = PROBLEMS_FOLDER + '/' + prob._id;
          prob.save(cb);
        });
      }
    } else {
      return cb(new Error('Problem already exists'));
    }
  });
}

module.exports = mongoose.model('Problem', problemSchema);
