'use strict';

const CronJob = require('cron').CronJob,
      async   = require('async'),
      _       = require('lodash');

const Problem = require('../models/problem'),
      Errors  = require('../utils/errors');

const LOAD_AND_IMPORT_INTERVAL = 24 * 60 * 60 * 1000;

const FETCH_PROBLEMS_CRON = '00 00 03 * * *';
const FETCH_PROBLEMS_TZ = 'America/Recife';

module.exports = (() => {
  let allProblems = {};
  let ojs = {};

  function importProblem(problem, callback) {
    ojs[problem.oj].import(problem, (err, data) => {
      problem.fullName = problem.originalUrl = null;
      if (!err && data) {
        problem.imported = !data.isPdf;
        for (var key in data) {
          problem[key] = data[key];
        }
        problem.url = `problems/${problem._id}`;
        console.log(`Imported ${problem.id} from ${problem.oj}`)
        return problem.save(callback);
      }
      problem.importTries++;
      return problem.save(() => {
        return callback(Errors.ImportFailed);
      });
    });
  }

  function shouldImport(problem) {
    return !problem.imported && !problem.isPdf && !problem.importTries < 10;
  }

  function importProblemSet(problems, callback) {
    let importers = _.chain(problems)
      .filter((problem) => {
        return shouldImport(problem);
      })
      .map((problem) => {
        return async.retryable(3, async.apply(importProblem, problem));
      });
    async.parallel(async.reflectAll(importers), callback);
  }

  function saveProblems(problems, callback) {
    async.eachSeries(problems, (data, next) => {
      Problem(data).save(next);
    }, callback);
  }

  function runProblemFetchers() {
    async.waterfall([
      (next) => {
        async.map(ojs, (oj, callback) => {
          return callback(null, oj.fetchProblems);
        }, next);
      },
      (fns, next) => {
        async.parallel(fns, next);
      },
      (problems, next) => {
        problems = _.chain(problems)
        .reduce((result, value, key) => {
          return _.concat(result, _.values(value));
        }, [])
        .filter((obj) => {
          return !_.has(allProblems, [obj.oj, obj.id]);
        })
        .value();
        saveProblems(problems, next);
      },
      loadProblems,
      importProblemSet,
    ], (err, results) => {
      // TODO: log error
    });
  }

  /*
   * The following steps will be executed everyday at 3AM GMT-3.
   * 1. Fetch problem base from all supported OJs.
   * 2. Filter the problems which are currently not listed on allProblems.
   * 3. Add the filtered problems to the database.
   * 4. Reload problems from the database and reset allProblems.
   * 5. Loop through database problems and imported those who are not yet
   *    imported.
   */
  function startDailyFetcher(callback) {
    let job = new CronJob({
      cronTime: FETCH_PROBLEMS_CRON,
      onTick: runProblemFetchers,
      timeZone: FETCH_PROBLEMS_TZ,
      runOnInit: (process.env.NODE_ENV === 'development')
    });
    job.start();
    return callback();
  }

  function loadProblems(callback) {
    Problem.find((err, problems) => {
      allProblems = _.groupBy(problems, 'oj');
      _.forEach(allProblems, (value, oj) => {
        allProblems[oj] = _.keyBy(value, 'id');
      });
      return callback(null, problems);
    });
  }

  this.start = (_ojs, callback) => {
    ojs = _ojs;
    async.series([
      loadProblems,
      startDailyFetcher,
    ], callback);
  };

  return this;
})();
