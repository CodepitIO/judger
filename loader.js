'use strict';

const fs = require('fs'),
      argv = require('optimist').argv,
      mongoose = require('mongoose');

const Problem = require('./models/problem'),
      db = require('./config/db');

/*
Problem.remove({oj: "cf"}, function(a,b,c) {
  console.log(a,b,c);
});
//*/

// Connect to the database
mongoose.connect(db.url);

// save problems from db to problems.txt
if (argv.save || argv.s) {
  try {
    fs.unlinkSync('./problems.txt');
  } catch(e) {}

  Problem.find().select('_id oj fullName url').exec().then(function(problems) {
    for (var i = 0; i < problems.length; i++) {
      if (problems[i].oj != 'uri' && problems[i].fullName.substring(0,1) === '[') {
        try {
          fs.appendFileSync('./problems.txt', problems[i].fullName + "\n\r" + problems[i].url + "\n\r" + problems[i]._id + "\n\r", {flags: 'a', mode: '0666'});
        } catch (err) {
          console.log(err);
        }
      }
    }
    process.exit();
  });
}
