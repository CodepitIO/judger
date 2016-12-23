module.exports = {
  name: 'LiveArchive',
  submitLang: {
    'c'       : '1',
    'cpp'     : '3',
    'cpp11'   : '5',
    'java'    : '2',
    'python3' : '6',
    // 'pascal' : '4',
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
    '' : -1,
    'Compilation error' : 4,
    'Runtime error' : 5,
    'Output Limit Exceeded' : 7,
    'Time limit exceeded' : 3,
    'Memory limit exceeded' : 6,
    'Wrong answer' : 2,
    'Presentation error' : 8,
    'Accepted' : 1
  },
  url: 'https://icpcarchive.ecs.baylor.edu',
  getProblemPath: (id) => {
    return '/external/' + Math.floor(id/100) + '/' + id + '.html';
  },
  getProblemPdfPath: (id) => {
    return '/external/' + Math.floor(id/100) + '/p' + id + '.pdf';
  },
}
