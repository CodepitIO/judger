const util = require('util');

var AbstractError = (function(){

    function cls(msg, constr) 
    {
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

function makeError(name, msg)
{
    function cls(msg)
    {
        cls.super_.call(this, msg, this.constructor);
    }

    util.inherits(cls, AbstractError);
    cls.prototype.name = name;
    cls.prototype.message = msg;
    return cls;
}

module.exports = {
    IsCurrent: makeError('IsCurrent Error', 'Account is current'),
    NotExist: makeError('NotExist Error', 'No such account'),
    NoEditor: makeError('NoEditor Error', 'No editor configured'),
    NoBrowser: makeError('NoBrowser Error', 'No browser configured'),
    UnmatchedQuote: makeError('UnmatchedQuote Error', 'Unmatched quote'),
    UnknownLang: makeError('UnknownLang Error', 'unknown language')
};
