var Account = require('../models/account');
var v = require('../adapters/adapterCF');
var s = new v(new Account({user: 'maratonando', pass: 'maratonando777', type: 'cf'}));

/* testing */
var fs = require('fs'),
    readline = require('readline');

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rd.on('line', function(line) {
  s.send("33A", "#include <bits/stdc++.h>\nint main() { printf(\"%d\", 50); }", "cpp", function(err, submissionId) {
    console.log(err, submissionId);
  });
});
