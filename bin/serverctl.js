/* eslint no-console:0 */
var fs = require('fs');
var path = require('path');
var PID_FILE = path.resolve(__dirname, 'mongodb-scope-server.pid');
var cp = require('child_process');
var runner = require('mongodb-runner');
var BIN = path.resolve(__dirname, '../node_modules/.bin/mongodb-scope-server');
var debug = require('debug')('mongodb-scope-server:ctl');

var getPID = function(done) {
  fs.exists(PID_FILE, function(exists) {
    if (!exists) return done(null, -1);

    fs.readFile(PID_FILE, 'utf-8', function(err, buf) {
      if (err) return done(err);

      done(null, parseInt(buf, 10));
    });
  });
};

var killIfRunning = function(done) {
  getPID(function(err, pid) {
    if (err) return done(err);

    if (pid === -1) {
      debug('no pid file');
      return done();
    }

    debug('killing existing pid', pid);
    try {
      process.kill(pid, 'SIGTERM');
    } catch (e) {
      debug('orphan pid file');
    }

    fs.unlink(PID_FILE, done);
  });
};

module.exports.start = function(done) {
  var onStarted = function(err) {
    if (err) return done(err);
    console.log('MongoDB started!  Starting server...');
    var server = cp.fork(BIN, {stdio: 'inherit'});
    fs.writeFile(PID_FILE, server.pid, done);
  };
  killIfRunning(function(err) {
    if (err) return done(err);

    console.log('Starting MongoDB...');
    runner({
      action: 'start'
    }, onStarted);
  });
};

module.exports.stop = function(done) {
  console.log('Stopping MongoDB...');
  runner({
    action: 'stop'
  }, function() {
    console.log('MongoDB stopped!  Stopping server...');
    killIfRunning(done);
  });
};
