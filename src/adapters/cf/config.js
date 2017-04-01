module.exports = {
  name: 'Codeforces',
  submitLang: {
    'c'         : '10',
    'cpp'       : '1',
    'cpp11'     : '42',
    'cpp14'     : '50',
    'java'      : '36',
    'python2.7' : '7',
    'python3'   : '31',
  },
  verdictId: {
    'IN_QUEUE': -1,
    'FAILED' : 2,
    'OK' : 1,
    'PARTIAL' : 2,
    'COMPILATION_ERROR' : 4,
    'RUNTIME_ERROR' : 5,
    'WRONG_ANSWER' : 2,
    'PRESENTATION_ERROR' : 8,
    'TIME_LIMIT_EXCEEDED' : 3,
    'MEMORY_LIMIT_EXCEEDED' : 6,
    'IDLENESS_LIMIT_EXCEEDED' : 3,
    'SECURITY_VIOLATED' : 10,
    'CRASHED' : 5,
    'INPUT_PREPARATION_CRASHED' : 11,
    'CHALLENGED' : 2,
    'SKIPPED' : 11,
    'TESTING' : -3,
    'REJECTED' : 11,
  },
  url: 'http://codeforces.com',
  getProblemPath: (id) => {
    let match = id.match(/(\d+)(.+)/i)
    return '/problemset/problem/' + match[1] + '/' + match[2]
  },
  submissionTTL: 60 * 60 * 1000,
}
