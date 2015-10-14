// app/models/oj_account.js
// load the things we need
var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.Types.ObjectId;

// define the schema for our user model
var ojAccountSchema = mongoose.Schema({
  user: String,
  pass: String,
  type: String,
  id: String
});
ojAccountSchema.set('autoIndex', false);

ojAccountSchema.methods.getUser = function getUser() {
  return this.user;
}
ojAccountSchema.methods.getPass = function getPass() {
  return this.pass;
}
ojAccountSchema.methods.getType = function getType() {
  return this.type;
}
ojAccountSchema.methods.getId = function getId() {
  return this.id;
}

module.exports = mongoose.model('OjAccount', ojAccountSchema);
