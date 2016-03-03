var request = require('superagent');
var EJSON = require('mongodb-extended-json');

// Override superagent's parse and encode handlers rather than
// adding another content-type tooling doesnt like.
request.serialize['application/json'] = EJSON.stringify;

var parseJSON = function parseJSON(res, fn) {
  res.text = '';
  res.setEncoding('utf8');
  res.on('data', function(chunk) { res.text += chunk;});
  res.on('end', function() {
    var err;
    var body;
    try {
      body = res.text && EJSON.parse(res.text);
    } catch (e) {
      err = e;
      err.rawResponse = res.text || null;
      err.statusCode = res.statusCode;
    } finally {
      fn(err, body);
    }
  });
};

request.parse['application/json'] = parseJSON;

if (typeof window === 'undefined') {
  request.parse['application/json'] = function(res, fn) {
    res.text = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      res.text += chunk;
    });
    res.on('end', function() {
      try {
        fn(null, EJSON.parse(res.text));
      } catch (err) {
        fn(err);
      }
    });
  };
}

module.exports = request;
