'use strict';

const CronJob = require('cron').CronJob,
      async   = require('async'),
      request = require('request'),
      _       = require('lodash')

const Problem   = require('../models/problem'),
      Errors    = require('../utils/errors'),
      S3        = require('./dbs').S3,
      S3Stream  = require('./dbs').S3Stream,
      Defaults = require('../config/defaults').oj

const LOAD_AND_IMPORT_INTERVAL = 24 * 60 * 60 * 1000;

const FETCH_PROBLEMS_CRON = '00 00 03 * * *';
const FETCH_PROBLEMS_TZ = 'America/Recife';

module.exports = (() => {
  let allProblems = {};
  let ojs = {};

  let count = 0

  function importSaveFail(problem, callback) {
    problem.importTries++;
    console.log(`<<<<<<< Error! ${problem.id} from ${problem.oj}.`)
    return problem.save(() => {
      return callback && callback(Errors.ImportFailed);
    });
  }

  function uploadToS3(problem, callback) {
    if (problem.isPdf) {
      let errored = false
      let obj = {Key: `problems/${problem._id}.pdf`, ACL: 'public-read'}
      let upload = S3Stream.upload(obj)
        .on('error', callback)
        .on('uploaded', (details) => {
          if (errored) return callback(new Error())
          return callback(null, details)
        })

      let url = Defaults[problem.oj].url + Defaults[problem.oj].getProblemPdfPath(problem.id)
      return request.get(url)
        .on('error', callback)
        .on('response', (response) => {
          if (response.headers['content-length'] < 200) errored = true
        })
        .pipe(upload)
    } else {
      let obj = {Key: `problems/${problem._id}.html`, Body: problem.html, ACL: 'public-read'}
      return S3.upload(obj, callback)
    }
  }

  function importProblem(problem, callback) {
    ojs[problem.oj].import(problem, (err, data) => {
      problem.fullName = problem.originalUrl = null
      if (!err && data && ((data.html && data.html.length > 200) || data.isPdf)) {
        for (var key in data) {
          problem[key] = data[key]
        }
        return async.timeout(async.apply(uploadToS3, problem), 30 * 1000)((err, details) => {
          if (err) return importSaveFail(problem, callback)
          count++
          console.log(`${count}: Imported ${problem.id} from ${problem.oj}.`)
          problem.imported = true
          problem.url = details.Location
          problem.html = undefined
          return problem.save(callback)
        })
      } else {
        return importSaveFail(problem, callback)
      }
    });
  }

  function shouldImport(problem) {
    return !problem.imported && !problem.importTries < 10;
  }

  function importProblemSet(problems, callback) {
    let importers = _.chain(problems)
      .filter((problem) => {
        return shouldImport(problem)
      })
      .map((problem) => {
        return async.retryable(3, async.apply(importProblem, problem));
      })
      .value()
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
    return callback && callback();
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
    async.waterfall([
      loadProblems,
      importProblemSet,
      startDailyFetcher,
    ], callback)
  };

  return this;
})();
