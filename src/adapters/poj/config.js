const SUPPORTED_LANGS = ['c', 'cpp', 'java'];

module.exports = {
  name: 'POJ',
  submitLang: {
    'c'         : '5',
    'cpp'       : '4',
    'java'      : '2',
  },
  verdictId: {
    'Compiling' : -4,
    'Running & Judging' : -3,
    'Waiting' : -1,
    'Accepted' : 1,
    'Wrong Answer' : 2,
    'Time Limit Exceeded' : 3,
    'Compile Error' : 4,
    'Runtime Error' : 5,
    'Memory Limit Exceeded' : 6,
    'Output Limit Exceeded' : 7,
    'Presentation Error' : 8,
  },
  url: 'http://poj.org',
  getProblemPath: (id) => {
    return '/problem?id=' + id
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  intervalPerAdapter: 6000,
  submissionTTL: 60 * 60 * 1000,
  maxImportWorkers: 1,
}
