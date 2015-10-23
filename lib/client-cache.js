/**
 * @todo (imlucas): refactor token to use this same pattern.
 * @todo (imlucas): Add tests.
 */
var async = require('async');
var debug = require('debug')('scout-client:client-cache');

var _instances = {};

exports.get = function(_id, fn) {
  debug('getting `%s`', _id);
  var client = _instances[_id];
  if (!fn) {
    return client;
  }
  process.nextTick(fn.bind(null, client));
};

exports.set = function(_id, obj, fn) {
  debug('adding `%s`', _id);
  if (!fn) {
    _instances[_id] = obj;
    return;
  }

  process.nextTick(function() {
    _instances[_id] = obj;
    fn();
  });
};

exports.remove = function(_id, fn) {
  debug('removing `%s`', _id);
  delete _instances[_id];
  if (fn) {
    process.nextTick(fn);
  }
};

exports.keys = function(fn) {
  if (!fn) {
    return Object.keys(_instances);
  }
  process.nextTick(function() {
    fn(null, Object.keys(_instances));
  });
};

exports.reset = function(fn) {
  if (!fn) {
    exports.keys().map(exports.remove);
    return;
  }

  exports.keys(function(err, keys) {
    if (err) {
      return fn(err);
    }
    if (keys.length === 0) {
      debug('no keys in cache to reset');
      return fn();
    }

    async.parallel(keys.map(exports.remove), function(_err) {
      if (_err) {
        return fn(_err);
      }
      debug('cache reset!');
      fn();
    });
  });
};

module.exports = exports;
