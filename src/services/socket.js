let io = require('socket.io-emitter')({ host: 'redis', port: 6379 })

exports.broadcast = (submission) => {
  io.broadcast.to(submission.contest).emit('submission', {
    date: submission.date,
    verdict: submission.verdict,
    problem: submission.problem,
    contestant: submission.contestant,
  })
}
