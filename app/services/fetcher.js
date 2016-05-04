'use strict';

const CronJob = require('cron').CronJob,
      async   = require('async'),
      _       = require('lodash');

const Problem     = require('../models/problem'),
      Defaults  = require('../config/defaults').oj;

module.exports = (() => {
  let allProblems = {};
  let ojs = {};

  function importProblem(problem, callback) {
    ojs[problem.oj].import(problem, (err, content) => {
      if (!err && content) {
        problem.imported = true;
        problem.html = content;
        problem.url = `problems/${problem._id}`;
        console.log(`Imported ${problem.id} from ${problem.oj}`);
        return problem.save(callback);
      }
      problem.importTries++;
      return problem.save(callback);
    });
  }

  function tryImportProblem(problem, callback) {
    callback = callback || (() => {});
    if (problem.imported || problem.importTries >= 5 || !Defaults[problem.oj].importContent) {
      return async.setImmediate(callback, null, problem);
    }
    importProblem(problem, callback);
  }

  function publishProblem(problem) {
    async.waterfall([
      tryImportProblem,
      (problem) => {

      }
    ]);
  }

  function loadProblems(done) {
    Problem.find((err, problems) => {
      _.forEach(problems, (problem) => {
        tryImportProblem(problem);
      });
      allProblems = _.groupBy(problems, 'oj');
      _.forEach(allProblems, (value, oj) => {
        allProblems[oj] = _.keyBy(value, 'id');
      });
      return done();
    });
  }

  function insertNewProblems(problems) {
    async.eachSeries(problems, (data, next) => {
      Problem(data).save((err, problem) => {
        allProblems[data.oj][data.id] = problem;
        publishProblem(problem);
        return next();
      });
    }, (err) => {});
  }

  function startProblemFetchers() {
    /*ojs = {
      //'uri': ojs.uri,
      //'cf': ojs.cf,
    };*/
    async.waterfall([
      (next) => {
        async.map(ojs, (oj, callback) => {
          return callback(null, oj.fetchProblems);
        }, next);
      },
      (fns, next) => {
        async.parallel(fns, next);
      }
    ], (err, problems) => {
      problems = _.reduce(problems, (result, value, key) => {
        return _.concat(result, _.values(value));
      }, []);
      problems = _.filter(problems, (o) => {
        return !allProblems[o.oj] || !allProblems[o.oj][o.id];
      });
      insertNewProblems(problems);
    });
  }

  function startCronJob(callback) {
    // We'll fetch new problems everyday at 5AM Recife
    var job = new CronJob({
      cronTime: '00 00 05 * * *',
      onTick: startProblemFetchers,
      timeZone: 'America/Recife',
      //runOnInit: (process.env.NODE_ENV === 'development')
    });
    job.start();
    return callback();
  }

  this.start = (_ojs, callback) => {
    ojs = _ojs;
    /*async.series([
      loadProblems,
      startCronJob,
    ], callback);*/
    //*/
  };

  return this;
})();
