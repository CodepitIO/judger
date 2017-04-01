'use strict';

const CronJob = require('cron').CronJob,
      async   = require('async'),
      request = require('request'),
      util    = require('util'),
      _       = require('lodash')

const Problem   = require('../models/problem'),
      Errors    = require('../utils/errors'),
      S3        = require('./dbs').S3

const LOAD_AND_IMPORT_INTERVAL = 24 * 60 * 60 * 1000
const S3_QUEUE_CONCURRENCY = 10

const FETCH_PROBLEMS_CRON = '00 00 03 * * *';
const FETCH_PROBLEMS_TZ = 'America/Recife';

module.exports = (() => {
  let allProblems = {};
  let ojs = {};

  let count = 0

  function importSaveFail(problem, callback) {
    if (!problem.imported) problem.importTries++
    console.log(`<<<<<<< Error! ${problem.id} from ${problem.oj}.`)
    return problem.save(() => {
      return callback && callback(Errors.ImportFailed);
    });
  }

  let uploadToS3Queue = async.queue((problem, callback) => {
    const OJConfig = require(`../adapters/${problem.oj}/config.js`);
    if (problem.isPdf) {
      let url = OJConfig.url + OJConfig.getProblemPdfPath(problem.id)
      request({url: url, encoding: null}, (err, res, body) => {
        if (err || res.headers['content-length'] < 200 || res.headers['content-type'] !== 'application/pdf') {
          return callback(err || new Error())
        }
        S3.upload({Key: `problems/${problem._id}.pdf`, Body: body, ACL: 'public-read', CacheControl: 'max-age=31536000'}, callback)
      })
    } else {
      let obj = {Key: `problems/${problem._id}.html`, Body: problem.html, ACL: 'public-read', CacheControl: 'max-age=1209600'}
      return S3.upload(obj, callback)
    }
  }, S3_QUEUE_CONCURRENCY)

  function importProblem(problem, callback) {
    ojs[problem.oj].import(problem, (err, data) => {
      problem.fullName = problem.originalUrl = null
      if (!err && data && ((data.html && data.html.length > 0) || data.isPdf)) {
        for (var key in data) {
          problem[key] = data[key]
        }
        return uploadToS3Queue.push(problem, (err, details) => {
          if (err) {
            console.log('>> ', err)
            return importSaveFail(problem, callback)
          }
          count++
          console.log(`${count}: Imported ${problem.id} from ${problem.oj} (${details.Location}).`)
          problem.importDate = new Date()
          problem.imported = true
          problem.url = details.Location
          problem.html = undefined
          return problem.save(callback)
        })
      } else {
        console.log('> ', err)
        return importSaveFail(problem, callback)
      }
    });
  }

  function shouldImport(problem) {
    let daysSinceImport = Math.round(
      (new Date() - (problem.importDate || 0)) / (24 * 60 * 60 * 1000));
    return (problem.imported && daysSinceImport > 90) ||
           (!problem.imported && problem.importTries < 10);
  }

  function importProblemSet(problems, callback) {
    let importers = _.chain(problems)
      .filter((problem) => {
        return shouldImport(problem)
      })
      .shuffle()
      .map((problem) => {
        return async.retryable(3, async.apply(importProblem, problem));
      })
      .value()
    async.parallel(async.reflectAll(importers), () => {
      return callback && callback()
    });
  }

  function saveProblems(problems, callback) {
    async.eachSeries(problems, (data, next) => {
      Problem(data).save(next);
    }, callback);
  }

  function decorateProblemFetch(oj, callback) {
    return callback(null, (done) => {
      oj.fetchProblems((err, fetched) => {
        console.log(oj.type)
        if (!fetched) err = err || new Error()
        if (err) console.log(err)
        else console.log(fetched.length + ' problems')
        return done(err, fetched)
      })
    })
  }

  function runProblemFetchers() {
    console.log('Running daily fetcher...')
    async.waterfall([
      (next) => {
        async.map(ojs, decorateProblemFetch, next);
      },
      (fns, next) => {
        async.parallel(async.reflectAll(fns), next);
      },
      (problems, next) => {
        problems = _.chain(problems)
        .reduce((result, elem, key) => {
          if (_.isArray(elem.value)) return _.concat(result, _.values(elem.value))
          else return result
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
    console.log('Setting up daily fetcher...')
    let job = new CronJob({
      cronTime: FETCH_PROBLEMS_CRON,
      onTick: runProblemFetchers,
      timeZone: FETCH_PROBLEMS_TZ,
      runOnInit: false,
    });
    job.start();
    return callback && callback();
  }

  function loadProblems(callback) {
    Problem.find((err, problems) => {
      allProblems = _.groupBy(problems, 'oj')
      _.forEach(allProblems, (value, oj) => {
        allProblems[oj] = _.keyBy(value, 'id')
      })
      return callback && callback(null, problems)
    });
  }

  function loadS3Objects(callback) {
    let CT = undefined
    let s3Objects = {}
    let totalSize = 0
    async.forever((next) => {
      S3.listObjectsV2({Prefix: 'problems/', ContinuationToken: CT}, (err, data) => {
        if (err) return next(err)
        _.forEach(data.Contents, (val) => {
          totalSize += val.Size
          let key = val.Key.match(/problems\/(.*)\.+/i)
          if (key) s3Objects[key[1]] = val.Key
        })
        console.log(`AWS S3 ${totalSize / 1024 / 1024}MB accumulate`)
        if (!data.NextContinuationToken) return callback && callback()
        CT = data.NextContinuationToken
        return next()
      })
    }, () => {
      return callback && callback()
    })
  }

  this.start = (_ojs, callback) => {
    ojs = {
      'codechef': _ojs.codechef,
    }
    console.log(ojs);
    async.waterfall([
      loadProblems,
      importProblemSet,
      startDailyFetcher,
    ], callback)
  };

  return this;
})();
