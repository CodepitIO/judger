var Adapter = require('../adapters/adapter');
var v = require('../adapters/adapterUVA');
var Account = require('../models/account');
var s = new v(new Account({user: 'j_maratonando', pass: 'maratonando777', type: 'uva'}));
s.send("100", "int main() {}", "cpp", function(a,b) {
  s.send("123", "int main() {}", "cpp", function(a,b) {
    console.log(a,b);
  });
});
