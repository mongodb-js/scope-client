var scout = require('../');
var debug = require('debug')('scout-client:test:helpers');
require('phantomjs-polyfill');

// scout.configure({
//   endpoint: 'http://localhost:29017',
//   mongodb: 'localhost:27017'
// });

module.exports = {
  client: null,
  createClient: function(opts) {
    opts = opts || {};
    module.exports.client = scout(opts);
    return module.exports.client;
  },
  before: function(done) {
    debug('before: creating client');
    module.exports.createClient();
    done();
  },
  after: function(done) {
    if (!module.exports.client) {
      debug('after: no client to close');
      return done();
    }

    debug('after: closing client');
    module.exports.client.close(function(err) {
      debug('after: client closed');

      if (err) return done(err);
      module.exports.client = null;

      debug('after: complete');
      done();
    });
  }
};
