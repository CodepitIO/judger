/*const util = require('util');

var AbstractError = (function() {

    function cls(msg, constr) {
        // If defined, pass the constr property to V8's
        // captureStackTrace to clean up the output
        Error.captureStackTrace(this, constr || this);

        // If defined, store a custom error message
        if (msg) this.message = msg;
    }

    util.inherits(cls, Error);
    cls.prototype.name = 'Abstract Error';
    return cls;
})();

function makeError(name, msg) {
    function cls(msg) {
        cls.super_.call(this, msg, this.constructor);
    }

    util.inherits(cls, AbstractError);
    cls.prototype.name = name;
    cls.prototype.message = msg;
    return cls;
}*/

/*module.exports = {
    InvalidLanguage: makeError('InvalidLanguage Error', 'Invalid language for problem'),
    SubmissionFail: makeError('SubmissionFail Error', 'Cannot submit'),
    LoginFail: makeError('LoginFail Error', 'Cannot login'),
    InvalidSubmission: makeError('InvalidSubmission Error', 'This submission has an unknown error and cannot be resubmitted'),
};*/

module.exports = {
    InvalidLanguage: new Error('Invalid language for problem'),
    SubmissionFail: new Error('Cannot submit'),
    LoginFail: new Error('Cannot login'),
    InvalidSubmission: new Error('This submission has an unknown error and cannot be resubmitted'),
    DuplicateOnlineJudgeID: new Error('Duplicate online judge id'),
};