const fs = require('fs');
const path = require('path');
const util = require('../utils/util');

// Maps from typeName to class function
var subClasses = {}; // private static field
var normNames = {}; // normalize the type name

module.exports = (function() {
    // constructor
    function cls(acct) {
        // public instance method
        /* return
         * @param error
         * @param submission id
         */
        this.send = function(probNum, codeString, language, callback) {
            this._send(
                probNum,
                codeString,
                language,
                true /* try login */,
                callback
            );
        };

        this.acct = function() {
            return acct;
        };
    }

    cls.normalizeType = function(s) {
        return normNames[s.toLowerCase()];
    };

    // public static method
    cls.create = function(acct) {
        if (!acct.type()) return null;
        var clsFn = subClasses[acct.type().toLowerCase()];
        if (clsFn) return new clsFn(acct);
        return null;
    };

    return cls;
})();

/*
 * Auto load the subclasses
 */
(function(){
    var files = fs.readdirSync(__dirname);
    for (var i=0; i < files.length; i++)
    {
        var match = /^adapter(\w+)/i.exec(files[i]);
        if (!match) continue;
        var modName = match[1];
        var lower = modName.toLowerCase();
        normNames[lower] = modName;
        subClasses[lower] = require('./'+files[i]);
    }
})();
