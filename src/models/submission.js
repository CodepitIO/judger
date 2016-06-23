'use strict';

const mongoose = require('mongoose')

const ObjectId = mongoose.Schema.Types.ObjectId

let schema = mongoose.Schema({
  contest: { type: ObjectId, ref: 'Contest' },
  contestant: { type: ObjectId, ref: 'User' },
  rep: ObjectId,

  problem: { type: ObjectId, ref: 'Problem' },
  code: String,
  language: String,

  date: { type: Date, default: Date.now },
  verdict: { type: Number, default: 0 },
  oj_id: { type: Number, default: -1 }
})

schema.index({ contest: 1, contestant: 1, date: -1 })
schema.index({ date: 1 })

module.exports = mongoose.model('Submission', schema)
