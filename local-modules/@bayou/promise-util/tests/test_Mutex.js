// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Mutex } from '@bayou/promise-util';

describe('@bayou/promise-util/Mutex', () => {
  describe('lock()', () => {
    it('works when there is blatantly no contention', async () => {
      const mutex = new Mutex();
      const unlock = await mutex.lock();

      assert.isFunction(unlock);
      unlock();
    });

    it('rejects attempts to double-unlock with the same unlocker', async () => {
      const mutex = new Mutex();
      const unlock = await mutex.lock();

      unlock();
      assert.throws(() => { unlock(); });
    });

    it('provides the lock in request order', async () => {
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

  describe('withLockHeld()', () => {
    it('works with a synchronous function when there is blatantly no contention', async () => {
      const mutex = new Mutex();

      const result = await mutex.withLockHeld(() => { return 'blort'; });
      assert.strictEqual(result, 'blort');

      await assert.isRejected(mutex.withLockHeld(() => { throw new Error('oy'); }));
    });

    it('works with an `async` function when there is blatantly no contention', async () => {
      const mutex = new Mutex();

      const result = await mutex.withLockHeld(async () => { return 'blort'; });
      assert.strictEqual(result, 'blort');

      await assert.isRejected(mutex.withLockHeld(async () => { throw new Error('oy'); }));
    });

    it('provides the lock in request order', async () => {
      const mutex = new Mutex();

      let result = 'x';
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const p = mutex.withLockHeld(() => { result += `${i}`; });
        promises.push(p);
      }

      await Promise.all(promises);
      assert.strictEqual(result, 'x0123456789');
    });

    it('rejects non-function arguments', async () => {
      const mutex = new Mutex();
      async function test(v) {
        await assert.isRejected(mutex.withLockHeld(v));
      }

      await test(null);
      await test(undefined);
      await test('foo');
      await test(Mutex);
    });
  });
});
