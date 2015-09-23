var createClient = require('./helpers').createClient;
var assert = require('assert');

describe('Connection', function() {
  it('should work with the defaults', function() {
    var client = createClient({
      autoconnect: false
    });

    var connection = client.connection;
    assert.equal(connection.endpoint, process.env.ENDPOINT);
    assert.equal(connection.autoconnect, false);
    assert.equal(connection.port, 27017);
    assert.equal(connection.hostname, 'localhost');
    assert.equal(connection.instance_id, 'localhost:27017');
  });

  it('should have the correct auth credentials', function() {
    var client = createClient({
      hostname: 'pet-store1.mongodb.parts',
      port: 27000,
      auth_source: 'taney',
      mongodb_username: 'arlo',
      mongodb_password: 'basil',
      autoconnect: false
    });

    var connection = client.connection;
    assert.equal(connection.getId(), process.env.ENDPOINT + '/pet-store1.mongodb.parts:27000');
    assert.equal(connection.endpoint, process.env.ENDPOINT);
    assert.equal(connection.autoconnect, false);
    assert.equal(connection.port, 27000);
    assert.equal(connection.hostname, 'pet-store1.mongodb.parts');
    assert.equal(connection.instance_id, 'pet-store1.mongodb.parts:27000');
  });
});
