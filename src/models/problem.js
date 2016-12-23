'use strict'

const mongoose = require('mongoose')

let problemSchema = mongoose.Schema({
  id: String,
  name: String,
  oj: String,
  url: String,
  originalUrl: String,
  fullName: String,
  imported: {
    type: Boolean,
    default: false
  },
  importTries: {
    type: Number,
    default: 0
  },
  importDate: Date,
  source: String,
  timelimit: Number,
  memorylimit: String,
  inputFile: String,
  outputFile: String,
  isPdf: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

problemSchema.index({
  oj: 1,
  id: 1
}, {
  unique: true
})

problemSchema.post('save', (problem, next) => {
  if (problem.fullName && problem.url && problem.originalUrl) return next()
  let oj = problem.oj
  let id = problem.id
  let name = problem.name
  const OJConfig = require(`../adapters/${oj}/config.js`);
  problem.fullName = "[" + OJConfig.name + " " + id + "] " + name
  if (!problem.url) {
    problem.url = OJConfig.url + OJConfig.getProblemPath(id)
  }
  if (problem.isPdf) {
    problem.originalUrl = OJConfig.url + OJConfig.getProblemPdfPath(id)
  } else {
    problem.originalUrl = OJConfig.url + OJConfig.getProblemPath(id)
  }
  problem.save(next)
})

module.exports = mongoose.model('Problem', problemSchema)
