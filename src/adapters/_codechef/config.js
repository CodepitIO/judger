module.exports = {
  name: 'CodeChef',
  submitLang: {
    'c' : '11',
    'java' : '10',
    'cpp' : '1',
    'pascal' : '2',
    'cpp11' : '44',
    'python3' : '116', // 3.4
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
  url: 'https://www.codechef.com',
  getProblemPath: (id) => {
    return `/problems/${id}`;
  },
}
