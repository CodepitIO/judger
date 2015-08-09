var Account = require('../models/account');
var v = require('../adapters/adapterSPOJBR');
var s = new v(new Account({user: 'maratonando', pass: 'maratonando777', type: 'spojbr'}));

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
    s.send("CARTEI14", "int ain() {}", "cpp", function(err, submissionId) {
      console.log(err, submissionId);    
    });
  } catch (err) {
    console.log("5");
  }
    /*if (line == 'send') {

    } else if (line == 'login') {
    }*/
});
