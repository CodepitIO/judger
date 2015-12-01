module.exports = {
    InvalidLanguage: new Error('Invalid language for problem'),
    SubmissionFail: new Error('Cannot submit'),
    LoginFail: new Error('Cannot login'),
    InvalidSubmission: new Error('This submission has an unknown error and cannot be resubmitted'),
    DuplicateOnlineJudgeID: new Error('Duplicate online judge id'),
    ProblemAlreadyExists: new Error('This problem already exists.'),
};