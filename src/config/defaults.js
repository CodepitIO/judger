'use strict';

module.exports = {
  STATIC_ASSETS_DOMAIN: (process.env.NODE_ENV !== 'development') ?
    'https://cdn.codepit.io' : 'https://cdn-dev.codepit.io',

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
    'python3' : '.py',
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
};
