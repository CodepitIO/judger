module.exports = {
  //GENERAL

  Judger: {
    scoreboardStatus: {
      "PENDING": 0,
      "WAITING": 1,
      "FAIL": 2,
      "SUCCESS": 3
    },

    submissionStatus: {
      "COMPILING": -4,
    	"RUNNING": -3,
    	"LINKING": -2,
    	"ON_JUDGE_QUEUE": -1,
    	"PENDING": 0,
    	"ACCEPTED": 1,
    	"WRONG_ANSWER": 2,
    	"TIME_LIMIT": 3,
    	"COMPILE_ERROR": 4,
    	"RUNTIME_ERROR": 5,
    	"MEMORY_LIMIT": 6,
    	"OUTPUT_LIMIT": 7,
    	"PRESENTATION_ERROR": 8,
      "UNKNOWN_ERROR": 9,
      "RESTRICTED_FUNCTION": 10,
      "INVALID_SUBMISSION": 11
    },

    verdictName: {
      "-4": "Compilando...",
      "-3": "Executando...",
      "-2": "Ligando...",
      "-1": "Enviado para Correção",
      "0": "Pendendo",
      "1": "Aceito",
      "2": "Resposta Errada",
      "3": "Tempo Limite Excedido",
      "4": "Erro de Compilação",
      "5": "Erro durante Execução",
      "6": "Limite de Memória Excedido",
      "7": "Limite de Escrita Excedido",
      "8": "Erro de Apresentação",
      "9": "Erro Desconhecido",
      "10": "Uso de função restrita",
      "11": "Submissão inválida",
    },

    //URI
    uri: {
      name: "URI",
      username: 'g8245059@trbvm.com',
      password: 'maratonando777',
      submitLang: {
        "java" : "3",
        "cpp" : "2",
      },
      verdictId: {
        "Closed" : 9,
        "Thinking..." : -3,
        "- In queue -" : -1,
        "Compilation error" : 4,
        "Runtime error" : 5,
        "Possible runtime error" : 5,
        "Time limit exceeded" : 3,
        "Wrong answer" : 2,
        "Presentation error" : 8,
        "Accepted" : 1
      },
      getUrl: function(id) {
        return "https://www.urionlinejudge.com.br/repository/UOJ_" + id + ".html";
      }
    },

    //SPOJBR
    spojbr: {
      name: "SpojBR",
      username: "maratonando",
      password: "maratonando777",
      submitLang: {
        "c" : "11",
        "java" : "10",
        "cpp" : "41",
        "pascal" : "22"
      },
      verdictId: {
        "0" : -1,
        "1" : -4,
        "3" : -3,
        "5" : -3,
        "11" : 4,
        "12" : 5,
        "13" : 3,
        "14" : 2,
        "15" : 1,
        "20" : 9,
      },
      getUrl: function(id) {
        return "http://br.spoj.com/problems/" + id;
      }
    },

    //SPOJ
    spoj: {
      name: "Spoj",
      username: "maratonando",
      password: "maratonando777",
      submitLang: {
        "c" : "11",
        "java" : "10",
        "cpp" : "41",
        "pascal" : "22"
      },
      verdictId: {
        "0" : -1,
        "1" : -4,
        "3" : -3,
        "5" : -3,
        "11" : 4,
        "12" : 5,
        "13" : 3,
        "14" : 2,
        "15" : 1,
        "20" : 9,
      },
      getUrl: function(id) {
        return "http://www.spoj.com/problems/" + id;
      }
    },

    //TIMUS
    timus: {
      name: "Timus",
      username: "166862LG",
      password: "_7sLrk$5ws",
      userid: "166862",
      submitLang: {
        "c" : "25",
        "java" : "32",
        "cpp" : "26",
        "pascal" : "31"
      },
      verdictId: {
        "Can't be judged" : 9,
        "Restricted function" : 10,
        "Submission error" : 9,
        "Running" : -3,
        "Linking" : -2,
        "Compiling" : -4,
        "In judge queue" : -1,
        "Sent to judge" : -1,
        "Received" : -1,
        "Compilation error" : 4,
        "Runtime error" : 5,
        "Runtime error (floating-point division by zero)" : 5,
        "Runtime error (integer division by zero)" : 5,
        "Runtime error (access violation)" : 5,
        "Output limit exceeded" : 7,
        "Time limit exceeded" : 3,
        "Memory limit exceeded" : 6,
        "Wrong answer" : 2,
        "Presentation error" : 8,
        "Accepted" : 1
      },
      getUrl: function(id) {
        return "http://acm.timus.ru/print.aspx?space=1&num=" + id;
      }
    },

    //LIVEARCHIVE
    la: {
      name: "LiveArchive",
      username: 'j_maratonando',
      password: 'maratonando777',
      submitLang: {
        "c" : "1",
        "java" : "2",
        "cpp" : "3",
        "pascal" : "4"
      },
      verdictId: {
        "Can't be judged" : 9,
        "Restricted function" : 10,
        "Submission error" : 9,
        "Running" : -3,
        "Linking" : -2,
        "Compiling" : -4,
        "In judge queue" : -1,
        "Sent to judge" : -1,
        "Received" : -1,
        "Compilation error" : 4,
        "Runtime error" : 5,
        "Output Limit Exceeded" : 7,
        "Time limit exceeded" : 3,
        "Memory limit exceeded" : 6,
        "Wrong answer" : 2,
        "Presentation error" : 8,
        "Accepted" : 1
      },
      getUrl: function(id) {
        return "https://icpcarchive.ecs.baylor.edu/external/" + Math.floor(id/100) + "/" + id + ".html";
      }
    },

    //UVA
    uva: {
      name: "UVa",
      username: 'j_maratonando',
      password: 'maratonando777',
      userid: '769719',
      submitLang: {
      	"c" : "1",
      	"java" : "2",
      	"cpp" : "3",
      	"pascal" : "4"
      },
      verdictId: {
        10 : 9,
        15 : 9,
        20 : -1,
        30 : 4,
        35 : 10,
        40 : 5,
        45 : 7,
        50 : 3,
        60 : 6,
        70 : 2,
        80 : 8,
        90 : 1
      },
      getUrl: function(id) {
        return "http://uva.onlinejudge.org/external/" + Math.floor(id/100) + "/" + id + ".html";
      }
    }
  }
};
