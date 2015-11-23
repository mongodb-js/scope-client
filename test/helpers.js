var scope = require('../');
var debug = require('debug')('mongodb-scope-client:test:helpers');

var ENDPOINT = process.env.ENDPOINT || 'http://localhost:29017';
process.env.ENDPOINT = ENDPOINT;

/* eslint no-console:0 */
debug('  tests will be run against the '
  + 'mongodb-scope-server endpoint `%s`', ENDPOINT);

module.exports = {
  client: null,
  createClient: function() {
    module.exports.client = scope.apply(null, arguments);
    return module.exports.client;
  },
  before: function(done) {
    debug('before: creating client', this.test);
    module.exports.createClient(ENDPOINT, 'localhost:27017');
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

      if (err) {
        return done(err);
      }
      module.exports.client = null;

      debug('after: complete');
      done();
    });
  }
};
