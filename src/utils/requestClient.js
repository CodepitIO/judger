'use strict';

const extend  = require('extend'),
      request = require('request'),
      _       = require('lodash');

function RequestClient(url) {
    let params = _.split(url, '://');
    this.protocol = params[0];
    this.host = params[1];
    this.jar = request.jar();
}

RequestClient.prototype.request = function(opts, callback){
    opts = extend(true, {
        jar: this.jar,
        followAllRedirects: true,
        rejectUnauthorized: false,
        headers: {
            'Accept-Charset': 'utf-8,ISO-8859-1',
            'Accept-Language': 'en-US,en;q=0.8',
            'User-Agent' :  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_0) "+
                            "AppleWebKit/537.36 (KHTML, like Gecko) "+
                            "Chrome/51.0.2704.103 Safari/537.36",
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
