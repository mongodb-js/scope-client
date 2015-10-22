// @todo (imlucas): :axe: to `mongodb-js-dox`?
var gulp = require('gulp');
var _dox = require('dox');
var fs = require('fs');
var pkg = require('./package.json');
var _ = require('underscore');
var _handlebars = require('handlebars');
var through = require('through2');
var gutil = require('gulp-util');
var format = require('util').format;

var debug = require('debug')('mongodb-js-dox');

/* eslint consistent-return:0, no-console:0 */

var STABILITY_BADGES = {
  deprecated: '![deprecated](http://b.repl.ca/v1/stability-deprecated-red.png)',
  prototype: '![prototype](http://b.repl.ca/v1/stability-prototype-orange.png)',
  development: '![development](http://b.repl.ca/v1/stability-development-yellow.png)',
  production: '![production](http://b.repl.ca/v1/stability-production-green.png)'
};

function getApis(methods, done) {
  var apis = [];
  methods.map(function(method) {
    if (method.ignore || method.description.full === '@ignore') {
      debug('skipping ignored `%j`', method);
      return;
    }

    var stability;
    var isProperty = false;
    var params = [];
    var args = [];
    var opts_arg;
    var group;
    var options = [];
    var todos = [];
    var examples = [];
    var streamable = false;

    if (!method.ctx) return console.error('huh?', method);

    method.tags.map(function(tag) {
      var matches;

      if (tag.type === 'param') {
        tag.optional = tag.name.indexOf('[') === 0;
        tag.name = tag.name.replace('[', '').replace(']', '');
        if (tag.name === 'opts') {
          opts_arg = tag;
        }
        args.push(tag.name);
        // debug('extracted param `%j`', tag);
        return params.push(tag);
      }
      if (tag.type === 'option') {
        debug('extracting option from `%s`', tag.string);
        matches = new RegExp('\{(\w+)\} (\w+) ?(.*)?').exec(tag.string);
        if (!matches) {
          debug('doesnt match old regex.  skipping.');
          return;
        }
        tag.types = [matches[1]];
        tag.name = matches[2];
        tag.description = matches[3] || '@todo';

        tag.description = tag.description.replace(' - ', '');
        return options.push(tag);
      }
      if (tag.type === 'example') {
        // debug('adding link to example for `%s`', tag.string);
        matches = new RegExp('([\w\d\/\:\.]+) (.*)').exec(tag.string);
        return examples.push({
          name: matches[2],
          url: matches[1]
        });
      }
      if (tag.type === 'group') {
        // debug('adding group `%s`', tag.string);
        group = tag.string;
        return;
      }
      if (tag.type === 'stability') {
        // debug('adding stability `%s`', tag.string);
        stability = tag.string;
        return;
      }
      if (tag.type === 'streamable') {
        // debug('marking as streamable');
        streamable = true;
        return;
      }
      if (tag.type === 'todo') {
        // debug('adding todo `%s`', tag.string);
        todos.push(tag.string);
      }
    });

    if (!isProperty && opts_arg && options.length > 0) {
      var optionsDescription = options.map(function(opt) {
        return format('    - `%s` (%s) ... %s',
          opt.name,
          opt.types.join('|'),
          opt.description.replace(' - ', '')
        );
      });

      opts_arg.description += format('\n%s\n', optionsDescription.join('\n'));
    }
    var res = {
      name: method.ctx.name,
      group: group,
      stability: stability,
      streamable: streamable,
      description: method.description.summary,
      params: params,
      args: args,
      options: options,
      todos: todos,
      source: method.code,
      examples: examples
    };
    debug('finished api is `%j`', res);
    apis.push(res);
  });

  done(null, apis);
}

function getContext(apis, done) {
  var context = _.extend(pkg, {
    apis_by_group: []
  });

  context.apis_by_group = _.chain(apis)
    .filter(function(api, i) {
      if (i === 0) {
        debug('skipping module.exports main entrypoint');
        return false; // @todo handle module level docs...
      }
      if (!api.group) {
        debug('Skipping api that has no group, is private or is ignored:\n',
          JSON.stringify(api, null, 2));
        return false; // private or ignore
      }
      return true;
    })
    .map(function(api) {
      return {
        name: api.name,
        group: api.group,
        args: api.args.join(', '),
        badge: STABILITY_BADGES[api.stability],
        stability: api.stability,
        description: api.description,
        hasExamples: api.examples.length > 0,
        examples: api.examples,
        hasParams: !api.isProperty && api.params.length > 0,
        params: _.map(api.params, function(d) {
          return {
            name: d.name,
            validation: d.optional ? 'optional' : 'required',
            types: d.types.join('|'),
            description: d.description ? '... ' + d.description : ''
          };
        }),
        hasTodos: api.todos.length > 0,
        todos: api.todos
      };
    })
    .groupBy('group')
    .map(function(_apis, group) {
      return {
        group: group,
        apis: _apis
      };
    })
    .value();
  done(null, context);
}

function dox(tpl) {
  return through.obj(function(file, enc, cb) {
    var self = this;

    function abort(err) {
      self.emit('error', err);
      return cb();
    }

    if (file.isNull()) {
      this.push(file);
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('gulp-dox', 'Streaming not supported'));
      return cb();
    }

    gutil.log('Parsing', gutil.colors.cyan(file.path), 'with dox');

    var methods = _dox.parseComments(file.contents.toString('utf-8'), {
      raw: true
    });

    debug('dox found %d methods', methods.length, methods.map(function(m) {
      return format('- %j', m.ctx.name);
    }).join('\n'));
    /* eslint no-shadow:0 */
    getApis(methods, function(err, apis) {
      if (err) return abort(err);

      getContext(apis, function(err, context) {
        if (err) return abort(err);

        fs.readFile(tpl, 'utf-8', function(err, buf) {
          if (err) return abort(err);
          file.base = file.cwd;
          file.path = file.base;
          // debug('Rendering template with context: \n', JSON.stringify(context, null, 2));
          var markdown = _handlebars.compile(buf)(context);
          file.contents = new Buffer(markdown);

          self.push(file);
          return cb();
        });
      });
    });
  });
}

// @todo: this should be wired to a precommit hook somewhere.
gulp.task('docs', function() {
  return gulp.src('./lib/client.js')
    .pipe(dox('./README.md.hbs'))
    .pipe(gulp.dest('README.md'));
});
