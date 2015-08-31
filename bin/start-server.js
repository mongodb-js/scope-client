#!/usr/bin/env node
var runner = require('mongodb-runner');

runner({
  action: 'start'
}, function() {
  /*eslint no-console:0*/
  require('./serverctl').start(function(err) {
    if (err) {
      console.error(err);
      process.exit(1);
      return;
    }
    process.exit(0);
  });
});
