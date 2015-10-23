var cache = require('../lib/client-cache');
var assert = require('assert');

describe('client-cache', function() {
  describe('synchronous', function() {
    /**
     * Regression Test: `Uncaught TypeError: Cannot read property 'apply' of undefined`
     *
     * ```
     *   app/index.js:8393:13Item.run
     *   app/index.js:8363:42drainQueue
     *   app/index.js:15404:30_super.bugsnag
     *   app/index.js:15879:15
     *```
     *
     * @see https://bugsnag.com/mongodb/mongodb-compass/errors/561ff924fe8ff431a07c1c01
     */
    it('should not defer a null function to nextTick', function() {
      cache.set('arlo', {
        type: 'dog'
      });
      assert.equal(cache.get('arlo').type, 'dog');

      cache.remove('arlo');

      assert.equal(cache.get('arlo'), undefined);

      cache.set('basil', {
        type: 'fluffy'
      });

      cache.set('kochka', {
        type: 'seabeast'
      });

      assert.equal(cache.keys().length, 2);
      cache.reset();
      assert.equal(cache.keys().length, 0);
    });
  });
});
