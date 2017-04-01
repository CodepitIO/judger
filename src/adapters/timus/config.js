const SUPPORTED_LANGS = ['c', 'cpp', 'cpp11', 'cpp14', 'java', 'python2.7', 'python3'];

module.exports = {
  name: 'Timus',
  submitLang: {
    'c'         : '25',
    'cpp'       : '26',
    'cpp11'     : '28',
    'cpp14'     : '30',
    'java'      : '32',
    'python2.7' : '34',
    'python3'   : '35',
    // 'pascal'  : '31',
  },
  verdictId: {
    'Can\'t be judged' : 11,
    'Restricted function' : 10,
    'Submission error' : 12,
    'Running' : -3,
    'Linking' : -2,
    'Compiling' : -4,
    'In judge queue' : -1,
    'Sent to judge' : -1,
    'Received' : -1,
    'Compilation error' : 4,
    'Runtime error' : 5,
    'Runtime error (floating-point division by zero)' : 5,
    'Runtime error (integer division by zero)' : 5,
    'Runtime error (access violation)' : 5,
    'Runtime error (non-zero exit code)': 5,
    'Output limit exceeded' : 7,
    'Time limit exceeded' : 3,
    'Memory limit exceeded' : 6,
    'Wrong answer' : 2,
    'Presentation error' : 8,
    'Accepted' : 1
  },
  url: 'http://acm.timus.ru',
  getProblemPath: (id) => {
    return '/print.aspx?space=1&num=' + id;
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  intervalPerAdapter: 6000,
}
