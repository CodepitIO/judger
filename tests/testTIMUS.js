var Adapter = require('../adapters/adapter');
var v = require('../adapters/adapterTIMUS');
var Account = require('../models/account');

var s = new v(new Account({user: '166862LG', pass: '166862LG', type: 'timus'}));
s.send("1000", "int main() {}", "cpp", function(a,b) {
  console.log(a,b);
  s.send("1000", "int main() {}", "cpp", function(a,b) {
    console.log(a,b);
  });
});
