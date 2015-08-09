const Adapter = require('../adapters/adapter');

module.exports = (function(){
    // constructor
    function cls(data) {
        // private instance fields
        var type = Adapter.normalizeType(data.type);
        var typeLower = data.type.toLowerCase();
        var user = data.user;
        var pass = data.pass;

        var obj = {
            type: type,
            user: user,
            pass: pass
        };

        /**
         * Gets the JSON object to be stringified.
         */
        this.toJSON = function(){
            return obj;
        };

        this.user = function(){return user;};
        this.pass = function(){return pass;};
        this.type = function(){return type;};
        this.adapter = Adapter.create(this);
    }

    return cls;
})();
