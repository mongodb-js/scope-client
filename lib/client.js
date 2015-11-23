/* eslint valid-jsdoc: 0 */
var assert = require('assert');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var EJSON = require('mongodb-extended-json');
var socketio = require('socket.io-client');
var ss = require('socket.io-stream');
var es = require('event-stream');
var raf = require('raf');
var request = require('./request');
var getOrCreateToken = require('./token');
var createRouter = require('./router');
var Subscription = require('./subscription');
var Resource = require('./resource');
var debug = require('debug')('mongodb-scope-client:client');
var toNS = require('mongodb-ns');
var format = require('util').format;
var Connection = require('./connection');
var cache = require('./client-cache');
var decodeError = require('./decode-error');

function Client(opts) {
  if (!(this instanceof Client)) {
    return new Client(opts);
  }

  this.connection = opts;
  this.readable = false;
  this.original = true;
  this.dead = false;
  this.closed = false;
  this._id = this.connection.getId();

  if (this.connection.autoconnect === true) {
    debug('autoconnecting...');
    this.connect();
  }
}
util.inherits(Client, EventEmitter);

/**
 * Creates or reusues a cached instance of `Client`.
 *
 * @param {String|Object} [endpoint] - Where scout-server is but if an
 * object is provided, it will be treated as model.
 * @param {Object} [model] - Attributes to pass to `mongodb-connection-model`.
 * @return {Client}
 * @example
 *   var createClient = require('mongodb-scope-client');
 *   var client = createClient({
 *     hostname: 'localhost',
 *     port: 27017,
 *     mongodb_username: null,
 *     mongodb_password: null,
 *     auth_source: null
 *   });
 */
function getOrCreateClient(endpoint, model) {
  if (typeof endpoint === 'object') {
    model = endpoint;
    endpoint = null;
  }
  if (typeof model === 'string') {
    var p = Connection.normalizeInstanceId(model).split(':');
    model = {
      hostname: p[0],
      port: parseInt(p[1], 10)
    };
  }

  var connection = model;
  if (!(model instanceof Connection)) {
    connection = new Connection(model);
  }

  var _id = connection.getId();
  var client = cache.get(_id);

  if (client === undefined) {
    debug('creating and conect new client...', _id);
    client = new Client(connection);
    cache.set(_id, client);
    return client;
  }
  debug('reusing client from cache', client);
  return client;
}

module.exports = getOrCreateClient;

/**
 * Just check if you can connect and close on success
 * or error.
 * @param {String} [endpoint] - URL of server [Default `http://localhost:29017`].
 * @param {Object} [model] - [MongoDB Connection][connection-model] [Default `{}`].
 * @param {Function} done - Callback for success or error with `(err)`.
 */
module.exports.test = function(endpoint, model, done) {
  debug('testing connection via `%s` to `%j`', endpoint, model);
  var client = getOrCreateClient(endpoint, model, model);

  // Number of ms to wait before treating the connection
  // attempt as stalled.
  var STALL = 15 * 1000;
  var stalledTimeout;
  var onError;
  var onSuccess = function() {
    debug('successfully connected!');
    clearTimeout(stalledTimeout);
    client.removeListener('error', onError);
    client.close(function() {
      done(null, model);
    });
  };

  onError = function(err) {
    clearTimeout(stalledTimeout);
    debug('connection test failed:', err);
    client.removeListener('readable', onSuccess);
    client.close(function() {
      done(err, model);
    });
  };

  var onStalled = function() {
    debug('client is stalled!');
    client.removeListener('readable', onSuccess);
    client.removeListener('error', onError);
    client.close(function() {
      done(new Error('Client stall detected'), model);
    });
  };

  stalledTimeout = setTimeout(onStalled, STALL);
  debug('will be marked as stalled after %dms', STALL);

  client.once('readable', onSuccess).once('error', onError);
  debug('waiting for a readable, stall, or error event...');
};

function isValidNamespace(val) {
  var ns = toNS(val);
  return ns.validDatabaseName && ns.validCollectionName;
}

function isValidDatabaseName(val) {
  return toNS(val).validDatabaseName;
}

/**
 * Accquire a token.
 * @return {Client}
 * @api private
 */
Client.prototype.connect = function() {
  if (this.token) {
    debug('Already connected');
    return this;
  }
  debug('connecting to `%s`...', this.connection.toString());
  getOrCreateToken(this.connection, function(err, token) {
    if (err) {
      return this.onError(err);
    }
    this.token = token;
    this.onTokenReadable();
  }.bind(this));

  return this;
};

/**
 * Get details of the instance you're currently connected to
 * like database_names, results of the hostInfo and buildInfo mongo commands.
 *
 * ```javascript
 * scout.instance(function(err, data){
 *   if(err) return console.error(err);
 *   console.log('Databases on ' + scout.connection.instance_id + ':');
 *   data.datbase_names.map(console.log.bind(console, ' -'));
 * });
 * ```
 *
 * @param {Object} [opts] Placeholder for future options
 * @param {Function} [fn] A response callback `(err, data)`
 *
 * @stability production
 * @group resource
 * @return {superagent.Request}
 */
Client.prototype.instance = function(opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }
  return this.read('/', opts, fn);
};

/**
 * List all deployments this scout-server instance has connected to.
 *
 * @param {Object} [opts] Placeholder for future options.
 * @param {Function} [fn] A response callback `(err, data)`.
 *
 * @stability production
 * @group resource
 * @return {superagent.Request}
 */
Client.prototype.deployments = function(opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }
  return this.read('/deployments', opts, fn);
};

/**
 * List collection names and stats.
 *
 * @param {String} name - The database name.
 * @param {Object} [opts] Placeholder for future options.
 * @param {Function} [fn] A response callback `(err, data)`.
 *
 * @stability production
 * @return {resource.Database|superagent.Request}
 * @group resource
 */
Client.prototype.database = function(name, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidDatabaseName(name)) {
    throw new TypeError('Invalid database name `' + name + '`');
  }

  var resource = new Resource.Database(this, '/databases', name);
  return !fn ? resource : resource.read(opts, fn);
};

/**
 * Collection stats
 *
 * @param {String} ns A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Object} [opts] Placeholder for future options
 * @param {Function} [fn] A response callback `(err, data)`
 *
 * @stability production
 * @return {resource.Collection|superagent.Request}
 * @group resource
 */
Client.prototype.collection = function(ns, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    throw new TypeError('Invalid namespace string `' + ns + '`');
  }
  var resource = new Resource.Collection(this, '/collections', ns);
  return !fn ? resource : resource.read(opts, fn);
};

/**
 * Index details
 *
 * @param {String} ns A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {String} name The index name
 * @param {Object} [opts] Placeholder for future options
 * @param {Function} [fn] A response callback `(err, data)`
 *
 * @stability development
 * @return {resource.Index|superagent.Request}
 * @group resource
 */
Client.prototype.index = function(ns, name, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    throw new TypeError('Invalid namespace string `' + ns + '`');
  }
  var resource = new Resource.Index(this, '/indexes/' + ns, name);
  return !fn ? resource : resource.read(opts, fn);
};

/**
 * Work with a single document.
 *
 * @param {String} ns A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {String} _id The document's `_id` value
 * @param {Object} [opts] Placeholder for future options
 * @param {Function} [fn] A response callback `(err, data)`
 *
 * @stability development
 * @return {resource.Document|superagent.Request}
 * @group resource
 */
Client.prototype.document = function(ns, _id, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    throw new TypeError('Invalid namespace string `' + ns + '`');
  }
  var resource = new Resource.Document(this, '/documents/' + ns, _id);
  return !fn ? resource : resource.read(opts, fn);
};

/**
 * Run a query on `ns`.
 *
 * @param {String} ns - A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Object} [opts] - Placeholder for future options
 * @param {Function} [fn] - A response callback `(err, data)`
 *
 * @option {Object} query - [Default `{}`].
 * @option {Number} limit - [Default `10`, max `200`].
 * @option {Number} skip - [Default `0`].
 * @option {Boolean} explain - Return explain instead of documents [Default `false`].
 * @option {Object} sort - `{key: (1|-1)}` spec [Default `null`].
 * @option {Object} fields - [Default `null`].
 * @option {Object} options - [Default `null`].
 * @option {Number} batchSize - [Default `null`].
 *
 * @group query
 * @stability production
 * @streamable
 * @return {superagent.Request|stream.Readable}
 */
Client.prototype.find = function(ns, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  if (!fn) {
    return new Resource.Collection(this, '/collections', ns).createReadStream(opts);
  }

  var params = {
    limit: opts.limit,
    skip: opts.skip,
    explain: opts.explain
  };
  ['query', 'sort', 'fields', 'options', 'batchSize'].forEach(function(key) {
    if (opts[key] !== undefined) {
      params[key] = EJSON.stringify(opts[key]);
    }
  });
  return this.read('/collections/' + ns + '/find', params, fn);
};

/**
 *  Run a count on `ns`.
 *
 * @param {String} ns A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Object} [opts] - Options
 * @param {Function} [fn] A response callback `(err, data)`
 *
 * @option {Object} query - [Default `{}`].
 * @option {Number} skip - [Default `0`].
 * @option {Boolean} explain - Return explain instead of documents [Default `false`].
 * @option {Object} options - [Default `null`].
 * @option {Number} batchSize - [Default `null`].
 *
 * @group query
 * @stability production
 * @return {superagent.Request|stream.Readable}
 */
Client.prototype.count = function(ns, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }
  if (!isValidNamespace(ns)) {
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  var params = {
    query: EJSON.stringify(opts.query || {}),
    skip: opts.skip || 0,
    explain: opts.explain || false,
    options: EJSON.stringify(opts.options || null),
    batchSize: EJSON.stringify(opts.batchSize || null)
  };
  return this.read('/collections/' + ns + '/count', params, fn);
};

/**
 *  Run an aggregation pipeline on `ns`.
 *
 * @example http://codepen.io/imlucas/pen/BHvLE Run an aggregation and chart it
 *
 * @param {String} ns A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Array} pipeline - Agg pipeline to execute.
 * @param {Object} [opts] - Options
 * @param {Function} fn A response callback `(err, data)`
 *
 * @option {Boolean} explain
 * @option {Boolean} allowDiskUse
 * @option {Object} cursor
 *
 * @group query
 * @stability development
 * @return {superagent.Request|stream.Readable}
 */
Client.prototype.aggregate = function(ns, pipeline, opts, fn) {
  if (!Array.isArray(pipeline)) {
    return fn(new TypeError('pipeline must be an array'));
  }
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/collections/' + ns + '/aggregate', {
    pipeline: EJSON.stringify(pipeline),
    explain: opts.explain || false,
    allowDiskUse: EJSON.stringify(opts.allowDiskUse || null),
    cursor: EJSON.stringify(opts.cursor || null),
    _streamable: true
  }, fn);
};

/**
 * Use [resevoir sampling](http://en.wikipedia.org/wiki/Reservoir_sampling) to
 * get a slice of documents from a collection efficiently.
 *
 * @param {String} ns - A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Object} [opts] - Options
 * @param {Function} fn - A response callback `(err, data)`
 *
 * @option {Number} size - The number of samples to obtain default `5`
 * @option {Object} query - Restrict the sample to a subset default `{}`
 * @option {Number} maxTimeMS - Maximum execution time `undefined`
 *
 * @group query
 * @stability development
 * @return {superagent.Request|stream.Readable}
 */
Client.prototype.sample = function(ns, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    var err = new TypeError('Invalid namespace string `' + ns + '`');
    if (fn) {
      return fn(err);
    }
    throw err;
  }

  if (fn) {
    return this.read('/collections/' + ns + '/sample', opts, fn);
  }
  opts.ns = ns;
  return this.createReadStream('collection:sample', opts);
};

/**
 *  Convenience to get 1 document via `Client.prototype.sample`.
 *
 * @param {String} ns - A namespace string, eg `#{database_name}.#{collection_name}`
 * @param {Object} [opts] - Options
 * @param {Function} fn - A response callback `(err, data)`
 *
 * @option {Object} query - Restrict the sample to a subset [Default `{}`].
 *
 * @group query
 * @stability development
 * @return {superagent.Request|stream.Readable}
 */
Client.prototype.random = function(ns, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  if (!isValidNamespace(ns)) {
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.sample(ns, opts, function(err, docs) {
    if (err) {
      return fn(err);
    }
    fn(null, docs[0]);
  });
};

/**
 * Maps backbone.js/express.js style routes to `Client.prototype` methods.
 *
 * @api private
 */
Client.prototype.routes = {
  '/instance': 'instance',
  '/deployments': 'deployments',
  '/deployments/:deployment_id': 'deployment',
  '/databases/:database': 'database',
  '/collections/:ns': 'collection',
  '/collections/:ns/count': 'count',
  '/collections/:ns/find': 'find',
  '/collections/:ns/aggregate': 'aggregate'
};

/**
 * Route `fragment` to a call on `Client.prototype`, which is substantially
 * easier for users on the client-side.  More detailled usage is available
 * in the [backbone.js adapter](/lib/backbone.js).
 *
 * @param {String} fragment - One of `Client.prototype.routes`
 * @param {Object} [opts] - Options
 * @param {Function} [fn] - Callback
 * @return {superagent.Request}
 * @ignore
 */
Client.prototype.get = function(fragment, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }
  var resolved = this.resolve(fragment);
  var handler = resolved[0];
  var args = resolved[1];

  args.push.apply(args, [opts, fn]);
  return handler.apply(this, args);
};

/**
 * Resolve a client handler with a fragment string.
 *
 * @param {String} fragment - One of `Client.prototype.routes`
 * @return {Array} The {Function} and [{String}] args
 *
 * @ignore
 */
Client.prototype.resolve = function(fragment) {
  if (!this.router) {
    this.router = createRouter(this.routes);
  }
  var route = this.router.resolve(fragment);
  return [this[route.method], route.args];
};

/**
 * Disconnect everything.  Done automatically for you on window unload/process
 * exit if in nodejs.
 *
 * @param {Function} [fn] Optional callback for completely closed.
 *
 * @ignore
 */
Client.prototype.close = function(fn) {
  cache.remove(this._id, function(err) {
    if (err) {
      return fn(err);
    }

    this.emit('close');
    this.readable = false;
    this.closed = true;
    if (this.io) {
      this.io.disconnect();
    }

    if (this.token) {
      this.token.close(function() {
        debug('token closed! calling callback');
        process.nextTick(fn);
      });
    } else if (fn) {
      debug('no token to close!  calling callback');
      process.nextTick(fn);
    }
  }.bind(this));
};

/**
 * All read requests come through here.
 * Handles queuing if still connecting and promoting streamables.
 *
 * @param {String} path Everything under `/api/v1` automatically prefixing instance.
 * @param {Object} [params] - HTTP query params.
 * @param {Function} [fn] A response callback `(err, data)`
 * @return {superagent.Request}
 * @api private
 */
Client.prototype.read = function(path, params, fn) {
  if (this.dead) {
    return fn(this.dead);
  }
  if (this.closed) {
    return fn(new Error('Client already closed'));
  }

  if (!this.readable) {
    debug('%s not readable.  queueing read', this._id, path, params);
    return this.once('readable', this.read.bind(this, path, params, fn));
  }

  if (typeof params === 'function') {
    fn = params;
    params = {};
  }
  var instance_id = this.connection.instance_id;
  var streamable = params._streamable;
  delete params._streamable;

  if (!fn && !streamable) {
    var msg = 'not streamable and missing callback';
    if (fn) {
      return fn(new Error(msg));
    }
    throw new Error(msg);
  }

  if (streamable && !fn) {
    return new Subscription(this, path, params);
  }

  if (path === '/') {
    path = '/' + instance_id;
  } else if (path !== '/deployments') {
    path = '/' + instance_id + path;
  }

  assert(this.token.toString());
  var url = format('%s/api/v1%s', this.connection.endpoint, path);
  return request.get(url)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.token.toString())
    .query(params)
    .end(this.ender(fn));
};

/**
 * Reponse handler for all superagent responses.
 *
 * @param {Function} fn A response callback `(err, data, res)`
 *
 * @api private
 * @return {Client}
 */
Client.prototype.ender = function(fn) {
  return function(err, res) {
    if (err) {
      err = decodeError(err);
      err.status = res.status;
    }
    fn.apply(null, [err, res && res.body, res]);
  };
};

/**
 * When we've acquired a security token, do child connections (eg socketio)
 * and unload handlers.
 *
 * If we're reusing an instance, but the user has changed connection,
 * emit `change` so any open streams can easily end the old one
 * and open a new stream on the current one.
 *
 * @api private
 */
Client.prototype.onTokenReadable = function() {
  debug('token is now readable!');
  debug('adding listener for token refresh...');
  this.token.on('refreshed', this.onTokenRefreshed.bind(this));

  if (!this.original) {
    this.emit('change');
  } else if (typeof window !== 'undefined' && window.document) {
    if (window.attachEvent) {
      window.attachEvent('onunload', this.onUnload.bind(this));
    } else {
      window.addEventListener('beforeunload', this.onUnload.bind(this));
    }
  } else {
    process.on('exit', this.onUnload.bind(this));
  }
};

/**
 * Create a new socket.io client, use our current
 * token to authenticate with the server's socket.io
 * endpoint, and add event listeners so we can piggyback
 * on socket.io-client's built-in reconnection features.
 */
Client.prototype._initSocketio = function() {
  if (this.io) {
    debug('already initialized socket.io client.  noop.');
    return;
  }
  debug('connecting to scout-server socket.io endpoint...');
  /**
   * @todo (imlucas): Allow specifying socket.io options as
   * part of the public api for testing and debugging.
   */
  var options = {
    timeout: 100,
    // transports: ['websocket'],
    'force new connection': true
  };

  this.io = socketio(this.connection.endpoint, options)
    .on('reconnecting', this.emit.bind(this, 'reconnecting'))
    .on('reconnect', this.onReconnect.bind(this))
    .on('reconnect_attempt', this.emit.bind(this, 'reconnect_attempt'))
    .on('reconnect_failed', this.emit.bind(this, 'reconnect_failed'))
    .on('disconnect', this.emit.bind(this, 'disconnect'))
    .on('authenticated', this.onSocketioAuthenticated.bind(this))
    .on('unauthorized', this.onSocketioUnauthorized.bind(this))
    .on('connect', this.onSocketioConnected.bind(this))
    .on('error', this.onError.bind(this));
};

Client.prototype.onSocketioConnected = function() {
  debug('Success!  Now authenticated with scout-server socket.io transport');

  this.readable = true;
  debug('now ready for use');
  this.emit('readable', this.token);
};

Client.prototype._sendSocketioHandshake = function() {
  debug('authenticating with scout-server socket.io transport...');
  this.io.emit('authenticate', {
    token: this.token.toString()
  });
};

Client.prototype.onSocketioAuthenticated = function() {
  debug('successfully authenticated with scout-server socket.io transport!');
};

Client.prototype.onSocketioUnauthorized = function(err) {
  debug('failed to authenticate with scout-server socket.io transport!');
  this.onError(err);
};

/**
 * On browser window unload or process exit if running in nodejs,
 * make sure we clean up after ourselves.
 *
 * @api private
 */
Client.prototype.onUnload = function() {
  if (!this.closed) {
    debug('unloading so im closin');
    this.close();
  }
};

/**
 * When a token error occurs, the browser can't provide us with good
 * context in the error, so for now assuming all token errors
 * mean scout-server is not running.
 *
 * @param {Error} err - Any error.
 * @api private
 */
Client.prototype.onError = function(err) {
  debug('handling client error', arguments);
  err = decodeError(err);
  /**
   * @todo (imlucas): Exponential back-off to retry connecting.
   */
  this.dead = err;
  this.emit('error', err);
};

/**
 * If the client loses contact with the server, socket.io
 * will emit a `reconnect` event when contact is re-established
 * at which point the client needs to a acquire a new token
 * and then re-authenticate it with the socket.io endpoint.
 *
 * @api private
 */
Client.prototype.onReconnect = function() {
  debug('reconnected! Getting fresh token...');
  getOrCreateToken(this.connection, function(err, token) {
    debug('getOrCreateToken returned', err, token);
    if (err) {
      return this.onError(err);
    }
    this.onTokenRefreshed();
  }.bind(this));
};

Client.prototype.onTokenRefreshed = function() {
  debug('token has been refreshed!');
  this._initSocketio();
  this._sendSocketioHandshake();
};

/**
 * EJSON parser transform used by `Client.prototype.createReadStream`.
 *
 * @param {Buffer} buffer - String sent via socket.io.
 * @param {Function} done - Transform callback.
 * @return {void}
 */
function parse_json_message(buffer, done) {
  var err;

  // `\n]\n`
  // End of the array has no documents so we can just drop it.
  if (buffer[0] === 10 && buffer[1] === 93 && buffer[2] === 10) {
    return done();
  }
  // `[\n`
  // Begining of the array and the first document.
  if (buffer[0] === 91 && buffer[1] === 10) {
    buffer = buffer.slice(2);
  } else if (buffer[0] === 10 && buffer[1] === 44 && buffer[2] === 10) {
    // `\n,\n`
    // A document that's not first.
    buffer = buffer.slice(3);
  } else {
    err = new Error('Unknown message `' + buffer.toString('utf-8') + '`');
  }
  if (err) {
    return done(err);
  }
  // No results :(
  if (buffer.length === 0) {
    return done();
  }
  var doc = JSON.parse(buffer, EJSON.reviver);

  done(null, doc);
}

/**
 * Provides a real `{stream.Readable}` via socket.io.
 *
 * @param {String} stream_id - e.g. `collection:sample`.
 * @param {Object} [options] - Options for the stream's constructor [Default: `{}`].
 * @api private
 * @return {stream.Readable}
 */
Client.prototype.createReadStream = function(stream_id, options) {
  debug('create read stream');
  if (this.dead) {
    throw this.dead;
  }
  if (this.closed) {
    throw new Error('Client already closed');
  }

  if (!this.readable) {
    debug('not readable yet.  queueing read', stream_id, options);
    var client = this;
    var transferred = false;

    var proxy;
    var done;
    proxy = es.readable(function(count, fn) {
      done = fn;
      debug('proxy _read called with count', count);
      if (!client.readable) {
        return debug('client still not readable');
      }
      if (transferred) {
        return debug('proxy already transferred');
      }
    });
    this.once('readable', function() {
      debug('client readable');
      var src = client.createReadStream(stream_id, options);
      src.on('data', function(data) {
        proxy.emit('data', data);
      });
      src.on('error', proxy.emit.bind(proxy, 'error'));
      src.on('end', proxy.emit.bind(proxy, 'end'));
      transferred = true;
      raf(function() {
        done();
      });
    });
    return proxy;
  }
  debug('creating socket.io stream...');

  // Inflate any BSON types the user might be trying to send
  // before passing to socket.io or else type information
  // will be lost in transit.
  // @see INT-506
  options = EJSON.inflate(options || {});

  var parser = es.map(parse_json_message);
  var stream = ss.createStream()
    .on('error', function(err) {
      parser.emit('error', err);
    });
  ss(this.io).emit(stream_id, stream, options);

  return stream.pipe(parser);
};
