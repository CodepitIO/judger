'use strict';

const mongoose = require('mongoose');

let ojAccountSchema = mongoose.Schema({
  user: String,
  pass: String,
  type: String,
  id: String,
  accessKey: String,
});
ojAccountSchema.set('autoIndex', false);

ojAccountSchema.methods.getUser = function() {
  return this.user;
}
ojAccountSchema.methods.getPass = function() {
  return this.pass;
}
ojAccountSchema.methods.getType = function() {
  return this.type;
}
ojAccountSchema.methods.getId = function() {
  return this.id;
}
ojAccountSchema.methods.getAccessKey = function() {
  return this.accessKey;
}

module.exports = mongoose.model('OjAccount', ojAccountSchema);
