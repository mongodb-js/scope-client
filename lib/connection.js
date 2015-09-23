var format = require('util').format;
var trimRight = require('lodash.trimright');
var omit = require('lodash.omit');
var BaseConnection = require('mongodb-connection-model');

// @todo: (imlucas) Dedupe this and Connection.initialize().
var os = require('os');
function normalizeInstanceId(instance_id) {
  if (instance_id) {
    instance_id = instance_id.replace(os.hostname(), 'localhost')
      .replace('mongodb://', '');
  }
  return instance_id;
}

var Connection = BaseConnection.extend({
  idAttribute: 'url',
  props: {
    /**
     * URL somewhere scout-server is listening on.
     */
    endpoint: {
      type: 'endpoint',
      default: 'http://localhost:29017'
    },
    autoconnect: {
      type: 'boolean',
      default: true
    }
  },
  dataTypes: {
    endpoint: {
      // @todo (imlucas): Support dynamic discovery... can't remember
      // specific use case right now...
      set: function(newVal) {
        if (/^https?:\/\./.test(newVal) === false) {
          newVal = format('http://%s', newVal);
        }
        newVal = trimRight(newVal, '/');
        return {
          val: newVal,
          type: 'endpoint'
        };
      }
    }
  },
  derived: {
    /**
     * From the client-side perspective, the `instance_id`
     * is relative to the `endpoint` of scout-server.
     *
     * @example
     *   scout('localhost:27017').url;
     *   >> 'http://localhost:29017/localhost:27017'
     *   scout('https://kangas.tunnel.mongodb.parts', 'localhost:27017').url;
     *   >> 'https://kangas.tunnel.mongodb.parts/localhost:27017'
     */
    url: {
      deps: ['endpoint', 'instance_id'],
      fn: function() {
        return [this.endpoint, this.instance_id].join('/');
      }
    }
  },
  // Need to omit the derived `instance_id` property now or
  // we'll get yelled at.
  serialize: function() {
    var res = BaseConnection.prototype.serialize.apply(this, arguments);
    return omit(res, 'instance_id', 'endpoint', 'autoconnect');
  }
});
Connection.prototype.toString = function() {
  return this.getId();
};
Connection.normalizeInstanceId = normalizeInstanceId;

module.exports = Connection;
