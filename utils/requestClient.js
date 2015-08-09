var extend = require('extend');
var request = require('request');

function RequestClient(protocol, host){
    this.protocol = protocol;
    this.host = host;
    this.jar = request.jar();
}

RequestClient.prototype.request = function(opts, callback){
    opts = extend(true, {
        jar: this.jar,
        followAllRedirects: true,
        headers: {
            'Accept-Charset': 'utf-8,ISO-8859-1',
            'Accept-Language': 'en-US,en;q=0.8',
            'User-Agent' :  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) "+
                            "AppleWebKit/537.17 (KHTML, like Gecko) "+
                            "Chrome/24.0.1312.57 Safari/537.17",
            "Accept" : "text/html, application/xml, text/xml, */*",
        },
    }, opts);
    request(opts, callback);
};

RequestClient.prototype.post = function(path, data, opts, callback){
    if (typeof opts === 'function'){
        callback = opts;
        opts = {};
    }
    opts = extend({
        method: "POST",
        form: data,
        url: path.charAt(0) === '/' ? this.protocol + "://" + this.host + path : path,
    }, opts);
    this.request(opts, callback);
};

RequestClient.prototype.postMultipart = function(path, data, opts, callback){
    if (typeof opts === 'function'){
        callback = opts;
        opts = {};
    }
    opts = extend({
        method: "POST",
        formData: data,
        url: path.charAt(0) === '/' ? this.protocol + "://" + this.host + path : path,
    }, opts);
    this.request(opts, callback);
};

RequestClient.prototype.get = function(path, opts, callback){
    if (typeof opts === 'function'){
        callback = opts;
        opts = {};
    }
    opts = extend({
        method: "GET",
        url: path.charAt(0) === '/' ? this.protocol + "://" + this.host + path : path,
    }, opts);
    this.request(opts, callback);
};

module.exports = RequestClient;
