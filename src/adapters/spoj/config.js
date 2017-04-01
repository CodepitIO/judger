module.exports = {
  name: 'Spoj',
  submitLang: {
    'c'         : /*[5.1*/ '11', /*3.7 '81'],*/
    'cpp'       : /*[5.1*/ '1', /*4.3 '41', 3.7 '82'],*/
    'cpp11'     : '44',
    'cpp14'     : '44',
    'java'      : '10',
    'python2.7' : '4',
    'python3'   : '116',
  },
  verdictId: {
    '0' : -1,
    '1' : -4,
    '3' : -3,
    '5' : -3,
    '11' : 4,
    '12' : 5,
    '13' : 3,
    '14' : 2,
    '15' : 1,
    '20' : 11,
  },
  url: 'http://www.spoj.com',
  getProblemPath: (id) => {
    return '/problems/' + id;
  },
}
