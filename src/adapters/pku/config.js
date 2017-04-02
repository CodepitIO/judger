const SUPPORTED_LANGS = ['c', 'cpp', 'java'];

module.exports = {
  name: 'PKU',
  submitLang: {
    'c'         : '5',
    'cpp'       : '4',
    'java'      : '2',
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
  url: 'http://poj.org',
  getProblemPath: (id) => {
    return '/problem?id=' + id
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  submissionTTL: 60 * 60 * 1000,
}
