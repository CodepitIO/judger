var Account = require('../models/account');
var v = require('../adapters/adapterSPOJ');
var s = new v(new Account({user: 'maratonando', pass: 'maratonando777', type: 'spoj'}));

/* testing */
var fs = require('fs'),
    readline = require('readline');

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rd.on('line', function(line) {
  try {
    s.send("TEST", "int main() {}", "cpp", function(err, submissionId) {
      console.log(submissionId);    
    });
  } catch (err) {
    console.log("5");
  }
    /*if (line == 'send') {

    } else if (line == 'login') {
    }*/
});
