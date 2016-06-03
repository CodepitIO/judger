module.exports = {
    InvalidLanguage: new Error('Invalid language for problem.'),
    SubmissionFail: new Error('Cannot submit.'),
    LoginFail: new Error('Cannot login.'),
    InternalError: new Error('This submission has an internal error and should not be resubmitted.'),
    DuplicateOnlineJudgeID: new Error('Duplicate online judge id'),
    ProblemAlreadyExists: new Error('This problem already exists.'),
    ResourceNotFound: new Error('Resource not found.'),
    NoImportForOJ: new Error('No import function for specified Online Judge.'),
    ImportFailed: new Error('Import failed.'),
};
