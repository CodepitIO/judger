var Account = require('../models/account');
var v = require('../adapters/adapterURI');
var s = new v(new Account({user: 'g8245059@trbvm.com', pass: 'maratonando777', type: 'uri'}));

/* testing */
var fs = require('fs'),
    readline = require('readline');

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rd.on('line', function(line) {
  s.send("1001", "#include <bits/stdc++.h>\nint main() { printf(\"%d\", 50); }", "cpp", function(err, submissionId) {
    console.log(err, submissionId);
  });
});
