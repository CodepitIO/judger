const puppeteer = require("puppeteer");
const async = require("async");
const util = require("util");
const path = require("path");
const fs = require("fs");
import { readFile } from "fs/promises";
const Browser = require("zombie");

const Utils = require("./common/lib/utils");
const RequestClient = require("./common/lib/requestClient");

const LOGIN_PAGE_PATH = "/enter",
  SUBMIT_PAGE_PATH = "/problemset/submit",
  STATUS_PATH = "/problemset/status",
  SUBMISSIONS_API = "/api/user.status?handle=%s&count=%s";

const LOGIN_TEST_REGEX = /logout/i,
  LLD_REGEX = /preferred\s+to\s+use\s+cin/i;

const Config = {
  url: "https://codeforces.com",
};

const client = new RequestClient(Config.url);

const LOGIN_PATH = path.join(__dirname, "login.html"),
  SUBMIT_PATH = path.join(__dirname, "submit.html");

function getBrowser() {
  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function login() {
  const file = await readFile(LOGIN_PATH);
  console.log(file);
  // if (!browser) browser = await getBrowser();
  // const page = await browser.newPage();
  // await page.goto("https://www.codechef.com/login");
  // try {
  //   await page.type("#edit-name", "godely");
  //   await page.type("#edit-pass", "920721");
  //   await Promise.all([
  //     page.click('input[value="Login"]'),
  //     page.waitForNavigation(),
  //   ]);
  // } catch (err) {
  //   await page.pdf({ path: "test.pdf" });
  // }
  // let html = (await page.content()) || "";
  // return new Promise((res, rej) => {
  //   if (!html.match(/logout/i)) {
  //     return rej(new Error("Error!"));
  //   }
  //   return res(null);
  // });
}

(async () => {
  await login();
})();

function getSubmissionId(callback) {
  let submissionsUrl = util.format(SUBMISSIONS_API, "godely", 1);
  client.get(submissionsUrl, { json: true }, (err, res, data) => {
    let id = data.result[0].id + "";
    return callback(null, id);
  });
}

async function send(submission) {
  if (!browser) browser = await getBrowser();
  const page = await browser.newPage();
  for (let i = 0; i <= 1; i++) {
    if (i === 1) {
      await login();
    }
    await page.goto("https://codeforces.com/problemset/submit");
    try {
      await page.type(
        'input[name="submittedProblemCode"]',
        submission.problemId
      );
      await page.select('select[name="programTypeId"]', submission.language);
      await page.type("#sourceCodeTextarea", submission.code);
      await page.pdf({ path: "1.pdf", format: "a4" });
      await Promise.all([
        page.click('input[value="Submit"]'),
        page.waitForNavigation(),
      ]);
      let html = (await page.content()) || "";
      if (html.match(LLD_REGEX)) {
        await page.click('input[name="doNotShowWarningAgain"]');
        await Promise.all([
          page.click('input[value="Submit"]'),
          page.waitForNavigation(),
        ]);
      }
      if (page.url().match("^https://codeforces.com/problemset/status")) {
        break;
      }
    } catch (err) {}
  }

  let html = (await page.content()) || "";
  return new Promise((resolve, reject) => {
    if (html.match(/should\s+satisfy\s+regex/i)) {
      return reject(new Error("Unretriable"));
    } else if (!page.url().match("^https://codeforces.com/problemset/status")) {
      return reject(new Error("Submission Fail " + page.url()));
    }
    return getSubmissionId(resolve, reject);
  });
}

var browser = new Browser({
  runScripts: false,
  strictSSL: false,
  waitDuration: 10000,
});

function login2(callback) {
  async.waterfall(
    [
      (next) => {
        browser.visit(Config.url + LOGIN_PAGE_PATH, next);
      },
      (next) => {
        browser.fill("#handleOrEmail", "godely" /* Replace */);
        browser.fill("#password", "920721" /* Replace */);
        browser.check("#remember");
        browser.pressButton('input[value="Login"]', next);
      },
    ],
    (err) => {
      let html = browser.html() || "";
      if (!html.match(LOGIN_TEST_REGEX)) {
        return login2(callback);
      }
      return callback(null);
    }
  );
}

function send2(submission, retry, callback) {
  console.log("EITA");
  async.waterfall(
    [
      (next) => {
        console.log("1");
        browser.visit(Config.url + SUBMIT_PAGE_PATH, next);
      },
      (next) => {
        try {
          browser.fill(
            'input[name="submittedProblemCode"]',
            submission.problemId
          );
          browser.select('select[name="programTypeId"]', submission.language);
          browser.fill("#sourceCodeTextarea", submission.code);
          browser.pressButton('input[value="Submit"]', next);
        } catch (err) {
          console.log(err);
          return next(new Error("Login Fail") /* Replace */);
        }
      },
      (next) => {
        let html = browser.html() || "";
        if (html.match(LLD_REGEX)) {
          return browser
            .check('input[name="doNotShowWarningAgain"]')
            .pressButton('input[value="Submit"]', next);
        }
        return next();
      },
    ],
    (err) => {
      require("fs").writeFileSync("test2.html", browser.html());
      if (err && !retry) {
        return callback(err);
      } else if (browser.html().match(/should\s+satisfy\s+regex/i)) {
        return callback(Errors.UnretriableError);
      } else if (browser.location.pathname !== STATUS_PATH) {
        if (!retry) {
          return callback(Errors.SubmissionFail);
        } else {
          browser = new Browser({ runScripts: false });
          return login2((err) => {
            if (err) return callback(err);
            return send2(submission, false, callback);
          });
        }
      }
      return getSubmissionId(callback);
    }
  );
}

async function _login(callback) {
  async.retry({ times: 5, interval: 2000 }, login, (err) => {
    if (err) {
      console.log(`Unable to login.`);
    } else {
      console.log(`Logged in successfully.`);
    }
    return callback && callback();
  });
}

function wait(timeout) {
  return new Promise((res) => setTimeout(res, timeout));
}

let sendQueue = async.queue(async (submission, callback) => {
  if (!submission || !submission.language) {
    return callback(Errors.InternalError);
  }
  let language = submission.language;
  let code = Utils.commentCode(submission.code, submission.language);
  console.log("A");
  await wait(3000);
  console.log("B");
  let data = {
    language: language,
    code: code,
    // if substitute id is set, give preference to it
    problemId: submission.problemId,
  };
  return send(data, true, callback);
}, 1);

const oj = require("./src/adapters/adapter").create({
  type: "cf",
  getType: () => "cf",
  getUser: () => "godely",
  getPass: () => "920721",
});

// getBrowser().then((browser) => {
//   browser.newPage().then((page) => {
//     page.goto("https://www.globo.com").then(() => {
//       page.screenshot({ path: "example.png" }).then(() => {
//         browser.close().then(() => {
//           console.log("Finished");
//         });
//       });
//     });
//   });
// });

// console.log("0");
// send2(
//   {
//     problem: { id: "33A" },
//     problemId: "33A",
//     language: "73",
//     code: "int main() {} // dasdae21321 ",
//   },
//   true,
//   (a, b) => {
//     console.log("Puxou 1!", a, b);
//   }
// );

// oj.send(
//   { problemId: "33A", language: "73", code: "int main() {}" },
//   (a, b) => {
//     console.log("Puxou 2!", a, b);
//   }
// );
