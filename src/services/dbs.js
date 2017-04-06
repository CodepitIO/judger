'use strict';

const redis     = require('redis'),
      mongoose  = require('mongoose');

const C = require('../../common/constants');

mongoose.Promise = require('bluebird')
mongoose.connect(C.CONN.MONGO.GET_URL());

var redisClient = redis.createClient({
  host: C.CONN.REDIS.HOST,
  prefix: process.env.NODE_ENV,
});

redisClient.on('error', console.log);

exports.redisClient = redisClient;

exports.createRedisClient = () => {
  return redis.createClient({
    host: C.CONN.REDIS.HOST,
    prefix: process.env.NODE_ENV,
  });
}
