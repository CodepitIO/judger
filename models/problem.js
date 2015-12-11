// app/models/problem.js
// load the things we need
var mongoose = require('mongoose');
var config = require('../config/defaults.js').oj;
var errors = require('../utils/errors');
var fs = require('fs');

// define the schema for our user model
var problemSchema = mongoose.Schema({
  id: String,
  id2: String,
  name: String,
  oj: String,
  url: String,
  fullName: String,
  level: Number,
  tags: [String],
});

problemSchema.statics.filterProblems = function(pattern, page_limit, callback) {
  this.find({
      "fullName": new RegExp(pattern, "i")
    },
    'fullName url',
    { limit: page_limit },
    callback
  );
}

problemSchema.statics.createNew = function(pid, pname, poj, cb) {
  var schema = this;
  schema.count({
    id: pid,
    oj: poj
  }, function(err, count) {
    if (!err && count == 0) {
      var fn = "[" + config[poj].name + " " + pid + "] " + pname;
      var newProblem = new schema({
        fullName: fn,
        id: pid,
        name: pname,
        oj: poj,
        url: config[poj].getUrl(pid)
      });
      console.log("Criou o problema " + fn);
      newProblem.save(cb);
    } else if (cb) {
      return cb(errors.ProblemAlreadyExists);
    }
  });
}

problemSchema.statics.saveProblemContent = function(pid, content, cb) {
  var schema = this;
  var path = 'problems/' + pid;
  fs.writeFile(path + '.html', content, function(err) {
    if (err) return cb(err);
    else schema.update({_id: pid}, {url: path}, cb);
  })
}

// create the model for problems and expose it to our app
module.exports = mongoose.model('Problem', problemSchema);
