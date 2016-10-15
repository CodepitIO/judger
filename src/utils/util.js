const http = require('http');
const qs = require('querystring');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const errors = require('./errors');
const Defaults = require('../config/defaults');

const LANG_C      = 1;
const LANG_JAVA   = 2;
const LANG_CPP    = 3;
const LANG_PASCAL = 4;
const LANG_CPP11  = 5;

(function(obj){

obj.LANG_C = LANG_C;
obj.LANG_JAVA = LANG_JAVA;
obj.LANG_CPP = LANG_CPP;
obj.LANG_PASCAL = LANG_PASCAL;
obj.LANG_CPP11 = LANG_CPP11;

/**
 * @param fileExt Lowercase file extension without the dot.
 * @return LANG_* constant or -1 if unrecognized
 */
obj.getLang = function(fileExt){
    switch (fileExt) {
      case 'c': return LANG_C;
      case 'java': return LANG_JAVA;
      case 'cpp': return LANG_CPP;
      case 'cpp11': return LANG_CPP11;
      case 'pascal': return LANG_PASCAL;
    }

    return -1;
};

obj.commentCode = function(code, lang) {
  if (lang === 'python3') {
    return code + '\n# ' + (new Date()).getTime();
  }
  if (lang == 'c') {
    return code + '\n/* ' + (new Date()).getTime() + ' */';
  }
  return code + '\n// ' + (new Date()).getTime();
};

obj.getLangName = function(lang){
    lang = parseInt(lang);
    switch(lang)
    {
    case LANG_C: return 'C';
    case LANG_JAVA: return 'Java';
    case LANG_CPP: return 'C++';
    case LANG_PASCAL: return 'Pascal';
    case LANG_CPP11: return 'C++11';
    }

    return '?';
};

obj.adjustImgSrcs = function($, oj) {
  $('img').each((i, elem) => {
    elem = $(elem);
    let link = elem.attr('src');
    if (link[0] === '/' || link[0] === '.') {
      let imgSrc = Defaults.oj[oj].url;
      if (link[0] === '.') imgSrc += '/';
      imgSrc += link;
      elem.attr('src', imgSrc);
    } else {
      elem.attr('src', link.replace('spoj.pl', 'spoj.com'));
    }
  });
}

/**
 * @return File extension without the dot; empty string if none.
 */
obj.getFileExt = function(filePath){
    var fileExt = path.extname(filePath);
    if (fileExt)
        return fileExt.substring(1);

    return '';
};

obj.createEndCallback = function(callback){
    var buf = '';
    return function(inMsg){
        inMsg.setEncoding('utf8');
        inMsg.on('readable', function(){buf += inMsg.read() || '';})
             .on('end', function(){callback(buf, inMsg);});
    };
};

/**
 * Removes surrounding quote chars (" or ') from a string.
 * Any whitespace surrounded by the quote chars are preserved but
 * whitespaces outside of the quote chars are removed. If no quote chars
 * are present the entire string is trimmed of whitespaces.
 * The string is processed adhering to the following rules:
 * - the starting and ending quote chars must be the same.
 * - if the starting or ending quote char is present, the other must also
 *    be present, that is, there must be no unmatched quote char.
 * <pre>
 * Examples:
 * String s = "  ' hello '  "; // unquote(s) returns "' hello '"
 * String s = "  'hello   ";   // unquote(s) will throw an exception
 * String s = " hello ";       // unquote(s) returns "hello"
 * </pre>
 * @param s
 * @exception if at least one
 * of the rules is violated.
 */
obj.unquote = function(s){
    s = s.trim();
    if (s.length >= 1)
    {
        var start = s.charAt(0);
        var end = s.length >= 2 ? s.charAt(s.length-1) : 0;
        var isQuote =
           (start === '"' || start === '\'' ||
            end   === '"' || end   === '\'');

        if (isQuote)
        {
            if (start === end)
                return s.substring(1, s.length-1);

            throw {message: "mismatched quote chars"};
        }
    }

    return s;
};

/**
 * Parses an HTML fragment containing attribute pairs without the
 * tag name, in to a map.
 * This is a forgiving parser that does not adhere strictly to XML rules,
 * but well-formed XML are guaranteed to be parsed correctly.
 * @param html This must be in the format: attrib1="value" attrib2="value"
 * @return Map of attrib-value pairs. The names and values are NOT HTML
 * decoded.
 */
obj.parseAttribs = function(html){

    const ATTRIB_PATTERN =
    // group 1: attrib name (allowing namespace)
    // group 2: value including quote chars if any
    /([\w:]+)\s*=\s*("[^"]*"|'[^']*'|\S*)/gi;

    var match, pairs = {};
    while (match = ATTRIB_PATTERN.exec(html))
    {
        pairs[match[1]] = obj.unquote(match[2]);
    }
    return pairs;
};

obj.getUserHomePath = function () {
    var p = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    if (p) return p;
    throw {message: "Cannot determine user home dir"};
};

obj.htmlDecodeSimple = function(s){
    return s.replace(/&apos;/g, '\'')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');
};

/**
 * @param method GET or POST
 * @param host domain name
 * @param path Absolute path e.g. /index.html
 * @param callback response callback function
 */
obj.createReq = function(method, host, path, callback){
    // encodeURI leaves the path components alone
    path = encodeURI(path);

    var options = {
        hostname: host,
        path: path,
        method: method,

        // typical headers to disguise our identity
        headers: {
            'Referer': 'http://'+host+path,
            'Accept-Charset': 'utf-8,ISO-8859-1',

            // NOTE: chunked is implied if content-length is missing,
            // explicitly putting it will confuse node.js which will leave
            // the connection dangling
            //'Transfer-Encoding': 'chunked',

            // no gzip :(
            //'Accept-Encoding': 'gzip,deflate',

            'Accept-Language': 'en-US,en;q=0.8',
            'User-Agent' :  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) "+
                            "AppleWebKit/537.17 (KHTML, like Gecko) "+
                            "Chrome/24.0.1312.57 Safari/537.17",
            "Accept" : "text/html, application/xml, text/xml, */*"
        }
    };

    return http.request(options, callback);
};

obj.writePostData = function(httpReq, data){
    var qstr = qs.stringify(data);
    httpReq.setHeader('Content-Type',
            "application/x-www-form-urlencoded; charset=UTF-8");
    httpReq.end(qstr, 'utf8');
};

obj.writeFormData = function(httpReq, data){
    var boundBytes = crypto.pseudoRandomBytes(16);
    var boundStr = (new Buffer(boundBytes)).toString('hex');

    httpReq.setHeader('Content-Type',
        'multipart/form-data; boundary='+boundStr);

    var bufCap = 1<<16;
    var buf = new Buffer(bufCap);

    for (var key in data)
    {
        var val = data[key];
        httpReq.write('--'+boundStr, 'ascii');

        // file upload?
        if (typeof val === 'object' && val.filePath)
        {
            httpReq.write("\r\nContent-Disposition: form-data; name=\""+ key +
                "\"; filename=\""+val.filePath+"\"\r\n"+
                "Content-Type: application/octet-stream\r\n"+
                "Content-Transfer-Encoding: binary\r\n\r\n", "utf8");

            var fd = fs.openSync(val.filePath, 'r');
            var bufSize = 0;

            while(true)
            {
                // read til buffer is full
                while (bufSize < bufCap)
                {
                    var nread = fs.readSync(fd, buf, bufSize, bufCap-bufSize, null);
                    if (nread == 0) break;
                    bufSize += nread;
                }

                if (bufSize === bufCap)
                {
                    bufSize = 0;
                    httpReq.write(buf);
                    continue;
                }

                httpReq.write(buf.slice(0, bufSize));
                break;
            }

            fs.closeSync(fd);
            httpReq.write("\r\n", 'ascii');
        }
        else
        {
            httpReq.write("\r\nContent-Disposition: form-data; name=\""+ key +"\"\r\n\r\n", 'utf8');
            httpReq.write(val+"\r\n", 'utf8');
        }
    }

    httpReq.end('--'+boundStr+"--\r\n",'ascii');
};

/**
 * Gets a semi-colon-separated list of cookies from the Set-Cookie headers,
 * without the cookies' metadata such as expiry and path.
 * The cookie keys and values are not decoded.
 * @return null if the cookies are not found.
 */
obj.getCookies = function(inMsg){

    var cookies = inMsg.headers["set-cookie"];
    if (typeof cookies === 'string')
    {
        cookies = [cookies];
    }
    else if (!cookies)
        return null;

    function get(line)
    {
        var tokens = line.split(';');

        // Cookie should be the first token
        if (tokens.length >= 1)
        {
            var pair = tokens[0].split("=");
            if (pair.length != 2) return null;

            var key = pair[0].trim();
            var value = pair[1].trim();

            return {key: key, value: value};
        }

        return null;
    }

    var z = '';
    var sep = '';
    for (var i = 0; i < cookies.length; i++)
    {
        var cookie = get(cookies[i]);
        if (!cookie) continue;
        z += sep + cookie.key + '=' + cookie.value;
        sep = '; ';
    }

    return z;
};

obj.parseForm = function(formPat, html){
    var match = formPat.exec(html);
    if (! match) return null;

    var attribs = match[1];
    var contents = match[2];
    var atts = obj.parseAttribs(attribs);
    var r = {contents: contents, data: {}};

    for (var key in atts) {
        if (key.toLowerCase() === 'action') {
            r.action = obj.htmlDecodeSimple(atts[key]);
            break;
        }
    }

    const inputPattern = /<input([^>]+?)\/?>/gi;
    while(match = inputPattern.exec(contents)) {
        atts = obj.parseAttribs(match[1]);
        var value = null, name = null, isText = false;

        for (var key in atts) {
            var val = obj.htmlDecodeSimple(atts[key]);
            var keyLower = key.toLowerCase();
            var valLower = val.toLowerCase();

            switch(keyLower) {
            case 'type':
                isText = (valLower === 'password' || valLower === 'text');
                break;
            case 'name':
                name = val;
                break;
            case 'value':
                value = val;
                break;
            }
        }

        if (name !== null && isText) {
            var nameLower = name.toLowerCase();
            if (nameLower.indexOf("user") >= 0)
                r.userField = name;
            else if (nameLower.indexOf("pass")>=0)
                r.passField = name;
        } else if (value !== null && name !== null) {
            r.data[name] = value;
        }
    }

    return r;
};

function skipWhitespace(s, startIdx)
{
    for (var i = startIdx; i < s.length; i++)
    {
        var cur = s.charAt(i);

        if (cur !== ' ' && cur !== "\t")
            return i;
    }

    return -1;
}

obj.parseArgs = function(s){
    var startQuote = null;
    var args = [];
    var curToken = '';

    var i = skipWhitespace(s, 0);
    if (i < 0) return args;

    for (; i < s.length; )
    {
        var cur = s.charAt(i);

        // inside a quoted arg?
        if (startQuote)
        {
            if (cur === startQuote)
            {
                args.push(curToken.trim());
                curToken = '';
                startQuote = null;
                i = skipWhitespace(s, i+1);
                if (i < 0) return args;
            }
            else
            {
                curToken += cur;
                i++;
            }
        }
        else
        {
            if (cur == '"' || cur == "'")
            {
                curToken = curToken.trim();

                if (curToken !== '')
                {
                    args.push(curToken);
                    curToken = '';
                }

                startQuote = cur;
                i++;
            }
            else if (cur == ' ' || cur == "\t")
            {
                args.push(curToken.trim());
                curToken = '';
                i = skipWhitespace(s, i+1);
                if (i < 0) return args;
            }
            else
            {
                curToken += cur;
                i++;
            }
        }
    }

    if (startQuote)
        throw new errors.UnmatchedQuote();

    if (curToken !== '')
        args.push(curToken.trim());

    return args;
};

})(module.exports);
