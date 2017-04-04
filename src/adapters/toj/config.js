const SUPPORTED_LANGS = ['c', 'cpp', 'java'];

module.exports = {
  name: 'TOJ',
  submitLang: {
    'c'         : '0',
    'cpp'       : '1',
    'java'      : '2',
  },
  verdictId: {
    'Compiling' : -4,
    'Running' : -3,
    'Waiting' : -1,
    'Accepted' : 1,
    'Wrong Answer' : 2,
    'Time Limit Exceeded' : 3,
    'Compilation Error' : 4,
    'Runtime Error' : 5,
    'Memory Limit Exceeded' : 6,
    'Output Limit Exceeded' : 7,
    'Presentation Error' : 8,
    'Restricted Function': 10,
  },
  url: 'http://acm.tju.edu.cn',
  getProblemPath: (id) => {
    return `/toj/showp${id}.html`
  },
  getSupportedLangs: () => SUPPORTED_LANGS,
  intervalPerAdapter: 6000,
  submissionTTL: 60 * 60 * 1000,
}
