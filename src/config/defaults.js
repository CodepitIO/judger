'use strict';

module.exports = {
  submissionStatus: {
    'COMPILING': -4,
  	'RUNNING': -3,
  	'LINKING': -2,
  	'ON_JUDGE_QUEUE': -1,
  	'PENDING': 0,
  	'ACCEPTED': 1,
  	'WRONG_ANSWER': 2,
  	'TIME_LIMIT': 3,
  	'COMPILE_ERROR': 4,
  	'RUNTIME_ERROR': 5,
  	'MEMORY_LIMIT': 6,
  	'OUTPUT_LIMIT': 7,
  	'PRESENTATION_ERROR': 8,
    'UNKNOWN_ERROR': 9, // DEPRECATED
    'RESTRICTED_FUNCTION': 10,
    'INTERNAL_ERROR': 11, // no retry, no penalty
    'SUBMISSION_ERROR': 12, // retry, no penalty
  },

  verdictName: {
    '-4': 'Compilando...',
    '-3': 'Executando...',
    '-2': 'Compilando...',
    '-1': 'Enviado para Correção',
    '0': 'Pendendo',
    '1': 'Aceito',
    '2': 'Resposta Errada',
    '3': 'Tempo Limite Excedido',
    '4': 'Erro de Compilação',
    '5': 'Erro durante Execução',
    '6': 'Limite de Memória Excedido',
    '7': 'Limite de Escrita Excedido',
    '8': 'Erro de Apresentação',
    '9': 'Erro Desconhecido', // DEPRECATED
    '10': 'Uso de função restrita',
    '11': 'Erro Interno',
    '12': 'Erro de submissão',
  },

  extensions: {
    'c' : '.c',
    'java' : '.java',
    'cpp' : '.cpp',
    'pascal' : '.pas',
    'cpp11' : '.cpp',
    'python' : '.py',
  },

  scoreboardStatusName: {
    '0': 'PENDING',
    '1': 'ACCEPTED',
    '2': 'REJECTED',
    '3': 'ERROR',
  },

  getScoreboardStatus: (verdict) => {
    if (verdict <= 0) {
      // Pending
      return 0;
    } else if (verdict === 1) {
      // Accepted
      return 1;
    } else if (verdict < 11) {
      // Rejected
      return 2;
    }
    // Error
    return 3;
  },

  oj: {
    //URI
    uri: {
      name: 'URI',
      submitLang: {
        'c' : '1',
        'cpp' : '2',
        'cpp11' : '2',
        'java' : '3',
        'python' : '4',
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
      intervalPerAdapter: 6000,
      submissionTTL: 60 * 60 * 1000,
    },

    //SPOJBR
    spojbr: {
      name: 'SpojBR',
      submitLang: {
        'c' : '11',
        'java' : '10',
        'cpp' : '41',
        'pascal' : '22',
        'cpp11' : '44',
	      'python' : '98',
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
      url: 'http://br.spoj.com',
      getProblemPath: (id) => {
        return '/problems/' + id;
      },
    },

    //SPOJ
    spoj: {
      name: 'Spoj',
      submitLang: {
        'c' : '11',
        'java' : '10',
        'cpp' : '41',
        'pascal' : '22',
        'cpp11' : '44',
	      'python' : '98',
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
    },

    //TIMUS
    timus: {
      name: 'Timus',
      submitLang: {
        'c' : '25',
        'java' : '32',
        'cpp' : '26',
        'pascal' : '31',
	      'cpp11' : '28',
	      'python' : '35',
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
      intervalPerAdapter: 6000,
    },

    //LIVEARCHIVE
    la: {
      name: 'LiveArchive',
      submitLang: {
        'c' : '1',
        'java' : '2',
        'cpp' : '3',
        'pascal' : '4',
        'cpp11' : '5',
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
    },

    //UVA
    uva: {
      name: 'UVa',
      submitLang: {
      	'c' : '1',
      	'java' : '2',
      	'cpp' : '3',
      	'pascal' : '4',
        'cpp11' : '5',
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
        'Output limit exceeded' : 7,
        'Time limit exceeded' : 3,
        'Memory limit exceeded' : 6,
        'Wrong answer' : 2,
        'Presentation error' : 8,
        'Accepted' : 1
      },
      url: 'https://uva.onlinejudge.org',
      getProblemPath: (id) => {
        return '/external/' + Math.floor(id/100) + '/' + id + '.html';
      },
      getProblemPdfPath: (id) => {
        return '/external/' + Math.floor(id/100) + '/p' + id + '.pdf';
      },
    },

    // HUXLEY
    huxley: {
      name: 'Huxley',
      submitLang: {
        'c' : '1',
        'java' : '6',
        'cpp' : '4',
        'pascal' : '3',
        'cpp11' : '4',
        'python' : '5',
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
    },

    // CODEFORCES
    cf: {
      name: 'Codeforces',
      submitLang: {
        'c' : '10',
        'java' : '36',
        'cpp' : '1',
        'pascal' : '4',
        'cpp11' : '42',
      	'python' : '31',
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
      url: 'http://codeforces.com',
      getProblemPath: (id) => {
        let match = id.match(/(\d+)(.+)/i)
        return '/problemset/problem/' + match[1] + '/' + match[2]
      },
    },

    // CODECHEF
    codechef: {
      name: 'CodeChef',
      submitLang: {
        'c' : '11',
        'java' : '10',
        'cpp' : '1',
        'pascal' : '2',
        'cpp11' : '44',
        'python' : '4',
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
    },
  },
};
