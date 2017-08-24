// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Mutex } from 'promise-util';

describe('util-common/Mutex', () => {
  describe('lock()', () => {
    it('should work when there is blatantly no contention', async () => {
      const mutex = new Mutex();
      const unlock = await mutex.lock();

      assert.isFunction(unlock);
      unlock();
    });

    it('should reject attempts to double-unlock with the same unlocker', async () => {
      const mutex = new Mutex();
      const unlock = await mutex.lock();

      unlock();
      assert.throws(() => { unlock(); });
    });

    it('should provide the lock in request order', async () => {
      const mutex       = new Mutex();
      const gotOrder    = [];
      const expectOrder = [];
      const innerProms  = [];

      // Get the lock, so we know there is contention when we make the
      // additional lock calls.
      const outerUnlock = await mutex.lock();

      // All of these `lock()`s will be queued up.
      for (let i = 0; i < 10; i++) {
        const unlockProm = mutex.lock();
        expectOrder.push(i);
        innerProms.push((async () => {
          const unlock = await unlockProm;
          gotOrder.push(i);
          unlock();
        })());
      }

      outerUnlock();

      // Wait for all the inner lock/unlock blocks (above) to run to completion.
      await Promise.all(innerProms);

      assert.deepEqual(gotOrder, expectOrder);
    });
  });
});
