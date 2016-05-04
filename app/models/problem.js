'use strict';

const mongoose = require('mongoose'),
      Defaults = require('../config/defaults.js').oj;

let problemSchema = mongoose.Schema({
  id: String,
  name: String,
  oj: String,
  url: String,
  fullName: String,
  imported: {type: Boolean, default: false},
  importTries: {type: Number, default: 0},
  html: String,
});

problemSchema.post('save', (problem, next) => {
  if (problem.fullName || problem.url) return next();
  let oj = problem.oj;
  let id = problem.id;
  let name = problem.name;
  problem.fullName = "[" + Defaults[oj].name + " " + id + "] " + name;
  problem.url = Defaults[oj].url + Defaults[oj].getProblemPath(id);
  problem.save(next);
});

module.exports = mongoose.model('Problem', problemSchema);
