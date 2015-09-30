#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
/* eslint no-sync:0 no-console: 0 */
var usage = fs.readFileSync(path.resolve(__dirname, './mongodb-collections.txt')).toString();
var args = require('minimist')(process.argv.slice(2), {
  boolean: ['debug']
});

if (args.debug) {
  process.env.DEBUG = 'mon*,sco*';
}

var createClient = require('../');
var test = require('../').test;
var assign = require('lodash.assign');
var parse = require('mongodb-uri').parse;
var chalk = require('chalk');
var figures = require('figures');
var async = require('async');
var pkg = require('../package.json');

args.url = args._[0];
args.endpoint = args._[1] || 'http://localhost:29017';

if (args.help || args.h || !args.url) {
  console.error(usage);
  process.exit(1);
}

if (args.version) {
  console.error(pkg.version);
  process.exit(1);
}
try {
  var parsed = parse(args.url);
} catch (e) {
  console.error('Could not parse url `%s`', args.url);
  console.error(e.message);
  process.exit(1);
}


var tasks = parsed.hosts.map(function(host) {
  return function(cb) {
    var connection = {
      hostname: host.host,
      port: host.port,
      auth_source: parsed.database,
      mongodb_username: parsed.username,
      mongodb_password: parsed.password
    };
    assign(connection, parsed.options);

    console.log(chalk.gray(figures.pointerSmall,
      'test connection to', JSON.stringify(connection) + figures.ellipsis));

    test(args.endpoint, connection, function(err) {
      if (err) {
        console.error(chalk.red.bold(figures.cross, 'Connection failed!'));
        console.error('  ', chalk.bold(err.message));
        console.error('  ', chalk.gray('Attempted to use connection',
          JSON.stringify(connection)));
        cb(err);
        return;
      }
      console.error('  ', chalk.green.bold(figures.tick),
        ' We\'re able to connect!\n\n');

      console.log(chalk.gray(figures.pointerSmall,
        'fetching collections' + figures.ellipsis));

      var client = createClient(args.endpoint, connection);
      client.instance(function(err, res) {
        if (err) {
          console.error(chalk.red.bold(figures.cross), 'Failed to get collections list from '
            + JSON.stringify(connection));
          console.error(chalk.gray(err.message));
          cb(err);
          return;
        }

        console.error(chalk.gray('Found', res.collections.length, 'collection(s):'));
        res.collections.map(function(col) {
          console.error('  ', chalk.gray(figures.pointerSmall, col._id));
        });
        console.error('  ', chalk.green.bold(figures.tick),
          ' Got the collection list!');

        client.close(cb);
      });
    });
  };
});

async.series(tasks, function(err) {
  if (err) {
    process.exit(1);
  }
});
