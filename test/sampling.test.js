var assert = require('assert');
var helpers = require('./helpers');
var debug = require('debug')('scout-client:test:sampling');

describe('Sampling', function() {
  before(helpers.before);
  after(helpers.after);

  it('should return a unique sample of the collection', function(done) {
    helpers.client.sample('local.startup_log', {
      size: 5
    }, function(err, res) {
      assert.ifError(err);

      var set = {};
      var ids = res.map(function(d) {
        set[d._id] = true;
        return d._id;
      });
      assert.equal(Object.keys(ids).length, ids.length, 'Returned non-uniques');
      done();
    });
  });

  it('should return a random document', function(done) {
    helpers.client.random('local.startup_log', function(err, res) {
      assert.ifError(err);
      assert(!Array.isArray(res));
      assert(res._id);
      done();
    });
  });

  describe('Streaming', function() {
    it('should work', function(done) {
      var docs = [];
      helpers.client.sample('local.startup_log', {
        limit: 5
      })
        .on('error', done)
        .on('data', function(d) {
          debug('got sampled doc from stream', d);
          docs.push(d);
        })
        .on('end', function() {
          debug('Sample stream ended!', docs);
          assert(docs.length > 0);
          done();
        });
    });
  });
});
