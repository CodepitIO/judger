'use strict';

const async = require('async');
const PendingSubmission = require('./models/pending_submission');

var pending = {};

module.exports = (function(ojs) {
  async.forever(
    function(next) {
      PendingSubmission
      .find()
      .populate('originalId')
      .exec()
      .then(function(submissions) {
        for (var i in submissions) {
          // creating a closure so we don't miss reference
          // to the variables
          (function(i) {
            var id = submissions[i]._id;
            if (!pending[id]) {
              var oj = ojs[submissions[i].problemOj];
              pending[id] = true;
              oj.send(submissions[i], function(err) {
                setImmediate(function() {
                  delete pending[id];
                });
              });
            }
          })(i);
        }
        // TODO set this time in a config file
        setTimeout(next, 1000);
      });
    },
    function(err) {
      console.log(err);
    }
  );
});