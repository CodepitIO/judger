const SUPPORTED_LANGS = ['c', 'cpp', 'cpp11', 'java', 'python2.7', 'python3'];

module.exports = {
  name: 'URI',
  submitLang: {
    'c'         : '1',
    'cpp'       : '2',
    'cpp11'     : '2',
    'java'      : '3',
    'python2.7' : '4',
    'python3'   : '5',
  },
  verdictId: {
    'Closed' : 11,
    'Thinking...' : -3,
    '- In queue -' : -1,
    'Compilation error' : 4,
    'Runtime error' : 5,
    'Possible runtime error' : 5,
    'Time limit exceeded' : 3,
    'Wrong answer' : 2,
    'Presentation error' : 8,
    'Accepted' : 1,
    'Submission error': 12,
  },
  url: 'https://www.urionlinejudge.com.br',
  getProblemPath: (id) => {
    return '/repository/UOJ_' + id + '.html';
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  intervalPerAdapter: 6000,
  submissionTTL: 60 * 60 * 1000,
}
