"use strict";

const redis = require("redis"),
  mongoose = require("mongoose");

const C = require("../../common/constants");

mongoose.Promise = require("bluebird");
mongoose.connect(C.CONN.MONGO.GET_URL(), {}, (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
});

const redisClient = redis.createClient({
  host: C.CONN.REDIS.HOST,
  prefix: process.env.NODE_ENV,
});

redisClient.on("error", console.log);

exports.redisClient = redisClient;

exports.createRedisClient = () => {
  return redis.createClient({
    host: C.CONN.REDIS.HOST,
    prefix: process.env.NODE_ENV,
  });
};
