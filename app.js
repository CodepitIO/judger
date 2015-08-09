const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const tty = require('tty');
const util = require('./utils/util');
const errors = require('./utils/errors');
const Account = require('./models/account');
const Adapter = require('./adapters/adapter');

module.exports = (function() {
    const SETTING_FILE_NAME = ".jdg-node";
    const SETTING_PATH = path.join(__dirname, SETTING_FILE_NAME);

    function cls() {
        /** All accounts. */
        var accts = {};
        var counter = {};

        function findAcct(type, user) {
            if (!accts.hasOwnProperty(type)) {
                return -1;
            }
            var acctsType = accts[type];
            for (var i = 0; i < acctsType.length; i++) {
                if (acctsType[i].user() == user) {
                    return i;
                }
            }

            return -1;
        }

        this.load = function(filePath) {
            var data = JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
            for (var type in data) {
                accts[type] = [];
                counter[type] = 0;
                for (var i = 0; i < data[type].length; i++) {
                    try {
                        accts[type].push(new Account(data[type][i]));
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        };

        this.save = function(filePath) {
            var data = {};
            for (var type in accts) {
                data[type] = [];
                for (var i = 0; i < accts[type].length; i++) {
                    data[type].push(accts[type][i].toJSON());
                }
            }
            var opts = {encoding: 'utf8', mode: 0600};
            try {
                fs.writeFileSync(filePath, JSON.stringify(data), opts);
            } catch (e) {
                console.log(e);
            }
        };

        this.add = function(type, user, pass) {
            var acct = new Account({
                type: type,
                user: user,
                pass: pass
            });
            type = type.toLowerCase();
            var idx = findAcct(type, acct.user());
            if (idx >= 0) {
                accts[type][idx] = acct;
            } else {
                accts[type] = accts[type] || [];
                accts[type].push(acct);
            }
            this.save(SETTING_PATH);
        };

        this.remove = function(type, user) {
            type = type.toLowerCase();
            var idx = findAcct(type, user);
            if (idx < 0) throw new errors.NotExist();
            accts[type].splice(idx, 1);
            this.save(SETTING_PATH);
        };

        this.list = function() {
            console.log(accts);
        };

        this.size = function(type){
            return accts[type].length;
        };

        this.getNext = function(type) {
            var i = counter[type];
            counter[type] = (counter[type]+1)%this.size(type);
            return accts[type][i];
        };

        try {
            this.load(SETTING_PATH);
        } catch (e) {}
    }

    return cls;
})();
