# scout-client [![][travis_img]][travis_url]

> The client to talk to [scout-server][server] from node.js or the browser.

Want to see what it can do? [Check out `./examples`][examples].

```
npm install --save scout-client
```

## API

```javascript
var scout = require('scout-client')([endpoint], [connection]);
```

#### Parameters

- `endpoint` (optional, String) ... Where the server is running [Default `http://localhost:29017`].
- `connection` (optional, Object|mongodb-connection-model) ... [MongoDB connection][connection-model] options [Default `{}`].

### resource

#### scout.instance (opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

Get details of the instance you're currently connected to
like database_names, results of the hostInfo and buildInfo mongo commands.


##### Parameters

- `opts` (optional, Object) ... Placeholder for future options
- `fn` (optional, Function) ... A response callback `(err, data)`


#### scout.deployments (opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

List all deployments this scout-server instance has connected to.


##### Parameters

- `opts` (optional, Object) ... Placeholder for future options.
- `fn` (optional, Function) ... A response callback `(err, data)`.


#### scout.database (name, opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

List collection names and stats.


##### Parameters

- `name` (required, String) ... - The database name.
- `opts` (optional, Object) ... Placeholder for future options.
- `fn` (optional, Function) ... A response callback `(err, data)`.


#### scout.collection (ns, opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

Collection stats


##### Parameters

- `ns` (required, String) ... A namespace string, eg `#{database_name}.#{collection_name}`
- `opts` (optional, Object) ... Placeholder for future options
- `fn` (optional, Function) ... A response callback `(err, data)`


#### scout.index (ns, name, opts, fn)

![development](http://b.repl.ca/v1/stability-development-yellow.png)

Index details


##### Parameters

- `ns` (required, String) ... A namespace string, eg `#{database_name}.#{collection_name}`
- `name` (required, String) ... The index name
- `opts` (optional, Object) ... Placeholder for future options
- `fn` (optional, Function) ... A response callback `(err, data)`


#### scout.document (ns, _id, opts, fn)

![development](http://b.repl.ca/v1/stability-development-yellow.png)

Work with a single document.


##### Parameters

- `ns` (required, String) ... A namespace string, eg `#{database_name}.#{collection_name}`
- `_id` (required, String) ... The document's `_id` value
- `opts` (optional, Object) ... Placeholder for future options
- `fn` (optional, Function) ... A response callback `(err, data)`


### query

#### scout.find (ns, opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

Run a query on `ns`.


##### Parameters

- `ns` (required, String) ... - A namespace string, eg `#{database_name}.#{collection_name}`
- `opts` (optional, Object) ... - Placeholder for future options
- `fn` (optional, Function) ... - A response callback `(err, data)`


#### scout.count (ns, opts, fn)

![production](http://b.repl.ca/v1/stability-production-green.png)

Run a count on `ns`.


##### Parameters

- `ns` (required, String) ... A namespace string, eg `#{database_name}.#{collection_name}`
- `opts` (optional, Object) ... - Options
- `fn` (optional, Function) ... A response callback `(err, data)`


#### scout.aggregate (ns, pipeline, opts, fn)

![development](http://b.repl.ca/v1/stability-development-yellow.png)

Run an aggregation pipeline on `ns`.

##### Examples

- [chart it](d)

##### Parameters

- `ns` (required, String) ... A namespace string, eg `#{database_name}.#{collection_name}`
- `pipeline` (required, Array) ... - Agg pipeline to execute.
- `opts` (optional, Object) ... - Options
- `fn` (required, Function) ... A response callback `(err, data)`


#### scout.sample (ns, opts, fn)

![development](http://b.repl.ca/v1/stability-development-yellow.png)

Use [resevoir sampling](http://en.wikipedia.org/wiki/Reservoir_sampling) to
get a slice of documents from a collection efficiently.


##### Parameters

- `ns` (required, String) ... - A namespace string, eg `#{database_name}.#{collection_name}`
- `opts` (optional, Object) ... - Options
- `fn` (required, Function) ... - A response callback `(err, data)`


#### scout.random (ns, opts, fn)

![development](http://b.repl.ca/v1/stability-development-yellow.png)

Convenience to get 1 document via `Client.prototype.sample`.


##### Parameters

- `ns` (required, String) ... - A namespace string, eg `#{database_name}.#{collection_name}`
- `opts` (optional, Object) ... - Options
- `fn` (required, Function) ... - A response callback `(err, data)`




[examples]: https://github.com/10gen/scout-client/tree/master/examples
[server]: https://github.com/10gen/scout-server
[connection-model]: https://github.com/mongodb-js/mongodb-connection-model
[travis_img]: https://secure.travis-ci.org/10gen/scout-client.svg?branch=master
[travis_url]: https://travis-ci.org/10gen/scout-client
