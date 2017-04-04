const SUPPORTED_LANGS = ['c', 'cpp', 'cpp11', 'java', 'python2.7'];

module.exports = {
  name: 'ZOJ',
  submitLang: {
    'c'         : '1',
    'cpp'       : '2',
    'cpp11'     : '9',
    'java'      : '4',
    'python2.7' : '5',
  },
  verdictId: {
    'Compiling' : -4,
    'Running' : -3,
    'Accepted' : 1,
    'Wrong Answer' : 2,
    'Time Limit Exceeded' : 3,
    'Compilation Error' : 4,
    'Segmentation Fault' : 5,
    'Non-zero Exit Code' : 5,
    'Floating Point Error' : 5,
    'Memory Limit Exceeded' : 6,
    'Output Limit Exceeded' : 7,
    'Presentation Error' : 8,
  },
  url: 'http://acm.zju.edu.cn',
  getProblemPath: (id) => {
    return `/onlinejudge/showProblem.do?problemCode=${id}`
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  intervalPerAdapter: 6000,
  submissionTTL: 60 * 60 * 1000,
}
