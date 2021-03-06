var assert = require('assert');
var helpers = require('./helpers');

function date(epoch) {
  var d = new Date();
  d.setTime(epoch);
  return d;
}

describe('Functional', function() {
  var scope;
  var result = [];
  var collection;

  before(function(done) {
    scope = helpers.createClient();
    // inserter = scope.collection('test.ejson_dates')
    //   .createWriteStream().on('end', done);

    // dataset([
    //   {_id: 'first', created_on: date(1405368259200)},
    //   {_id: 'second', created_on: date(1405368259210)},
    //   {_id: 'third', created_on: date(1405368259220)}
    // ]).pipe(inserter);

    // TODO: Use mongodb-datasets.
    var docs = [
      {
        _id: 'first',
        created_on: new Date(1405368259200)
      },
      {
        _id: 'second',
        created_on: new Date(1405368259210)
      },
      {
        _id: 'third',
        created_on: new Date(1405368259220)
      }
    ];
    var pending = docs.length;

    collection = scope.collection('test.ejson_dates');
    collection.create(function(err) {
      if (err) {
        return done(err);
      }

      docs.map(function(doc) {
        /* eslint no-shadow:0 */
        scope.document('test.ejson_dates').create(doc, function(err, res) {
          if (err) {
            return done(err);
          }

          result.push(res);

          pending--;
          if (pending === 0) {
            done();
          }
        });
      });
    });
  });

  after(function(done) {
    collection.destroy(done);
  });

  it('should have inserted `created_on` as a date', function() {
    assert.equal(result.length, 3);
    result.map(function(doc) {
      assert(doc.created_on.getTime, 'Not a date? ' + doc.created_on);
    });
  });

  it('should serialize dates in queries', function(done) {
    var second_date = date(1405368259210);
    var query = {
      created_on: {
        $gt: second_date
      }
    };

    scope.find('test.ejson_dates', {
      query: query
    }, function(err, res) {
      if (err) {
        return done(err);
      }

      assert(Array.isArray(res));
      assert.equal(res.length, 1);
      done();
    });
  });
});
