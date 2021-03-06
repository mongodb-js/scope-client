var util = require('util');
var bulk = require('./bulk');
var cursor = require('./cursor');
var request = require('./request');

function Resource(client, uri, _id) {
  if (!(this instanceof Resource)) {
    return new Resource(client, uri, _id);
  }

  this.client = client;
  this.uri = uri;
  this._id = _id;
}
Resource.prototype.root = function() {
  return '/api/v1/' + this.client.connection.instance_id;
};

/**
 * Dispatcher for superagent deletes, posts and puts.
 *
 * @param {String} method - superagent method eg `del`.
 * @param {String} pathname - Pathname under `resource.root()`.
 * @param {Object} data - Request body to serialize as json.
 * @param {Function} fn - Callback.
 * @return {superagent.Request}
 * @api private
 */
Resource.prototype.exec = function(method, pathname, data, fn) {
  data = data || {};
  if (typeof data === 'function') {
    fn = data;
    data = {};
  }

  if (this.client.dead) {
    return fn(this.client.dead);
  }

  if (!this.client.readable) {
    return this.client.on('readable', this.exec.bind(this, method, pathname, data, fn));
  }

  var req = request[method](this.client.connection.endpoint + (this.root() || '') + pathname)
    .accept('json')
    .set('Authorization', 'Bearer ' + this.client.token.toString());


  if (method !== 'del') {
    req.type('json').send(data);
  }

  return req.end(this.client.ender(fn));
};

Resource.prototype.read = function(opts, fn) {
  this.client.read(this.uri + '/' + encodeURIComponent(this._id), opts, fn);
  return this;
};

Resource.prototype.create = function(data, fn) {
  return this.exec('post', this.uri + '/' + encodeURIComponent(this._id), data, fn);
};

Resource.prototype.update = function(data, fn) {
  return this.exec('put', this.uri + '/' + encodeURIComponent(this._id), data, fn);
};

Resource.prototype.destroy = function(fn) {
  return this.exec('del', this.uri + '/' + encodeURIComponent(this._id), {}, fn);
};

Resource.prototype.createReadStream = function() {
  throw new Error('Not implemented');
};

Resource.prototype.createWriteStream = function() {
  throw new Error('Not implemented');
};

function Document(client, uri, _id) {
  if (!(this instanceof Document)) {
    return new Document(client, uri, _id);
  }
  Document.super_.call(this, client, uri, _id);
}
util.inherits(Document, Resource);

Document.prototype.create = function(data, fn) {
  this._id = data._id;
  return this.exec('post', this.uri, data, fn);
};

function Index(client, uri, _id) {
  if (!(this instanceof Index)) {
    return new Index(client, uri, _id);
  }
  Index.super_.call(this, client, uri, _id);
}
util.inherits(Index, Resource);

Index.prototype.create = function(field, fn) {
  return this.exec('post', this.uri, {
    field: field
  }, fn);
};
Index.prototype.update = function(options, fn) {
  return this.exec('put', this.uri, {
    field: this._id,
    options: options
  }, fn);
};

function Tunnel(client, _id) {
  if (!(this instanceof Tunnel)) {
    return new Tunnel(client, _id);
  }

  this.client = client;
  this._id = _id;
}

Tunnel.prototype.root = function() {
  return '/api/v1';
};

Tunnel.prototype.create = function(data, fn) {
  return this.exec('post', '/tunnel', data, function(err, res) {
    if (err) {
      return fn(err);
    }
    this._id = res._id;
    fn();
  }.bind(this));
};

Tunnel.prototype.destroy = function(fn) {
  return this.exec('post', '/tunnel/' + this._id, {}, fn);
};

function Collection(client, uri, _id) {
  if (!(this instanceof Collection)) {
    return new Collection(client, uri, _id);
  }
  Collection.super_.call(this, client, uri, _id);
}
util.inherits(Collection, Resource);

Collection.prototype.bulk = function(data, fn) {
  return this.exec('post', '/collections/' + encodeURIComponent(this._id) + '/bulk', data, fn);
};

Collection.prototype.createWriteStream = function(opts) {
  return bulk.createWriteStream(this, opts);
};

Collection.prototype.createReadStream = function(opts) {
  return cursor.createReadStream(this.client, this._id, opts);
};

function Database(client, uri, _id) {
  if (!(this instanceof Database)) {
    return new Database(client, uri, _id);
  }
  Database.super_.call(this, client, uri, _id);
}
util.inherits(Database, Resource);

Database.prototype.create = function(name, fn) {
  return this.exec('post', this.uri, {
    database_name: name
  }, fn);
};

module.exports = Resource;
module.exports.Document = Document;
module.exports.Database = Database;
module.exports.Index = Index;
module.exports.Tunnel = Tunnel;
module.exports.Collection = Collection;
module.exports.Operation = Resource;
