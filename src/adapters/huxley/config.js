module.exports = {
  name: 'Huxley',
  submitLang: {
    'c'         : '1',
    'cpp'       : '4',
    'cpp11'     : '4',
    'java'      : '6',
    'python2.7' : '2',
    'python3'   : '5',
    // 'pascal' : '3',
  },
  verdictId: {
    'WAITING' : -3,
    'CORRECT' : 1,
    'EMPTY_ANSWER' : 2,
    'WRONG_ANSWER' : 2,
    'TIME_LIMIT_EXCEEDED' : 3,
    'COMPILATION_ERROR' : 4,
    'RUNTIME_ERROR' : 5,
    'PRESENTATION_ERROR' : 8,
    'WRONG_FILE_NAME' : 11,
    'EMPTY_TEST_CASE' : 11,
    'HUXLEY_ERROR' : 11,
  },
  url: 'http://www.thehuxley.com',
  getProblemPath: (id) => {
    return '/problem/' + id;
  },
}
