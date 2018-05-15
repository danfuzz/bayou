// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Condition } from '@bayou/promise-util';

describe('@bayou/promise-util/Condition', () => {
  describe('constructor()', () => {
    it('should offer the constructed value', () => {
      let cond;

      cond = new Condition();
      assert.strictEqual(cond.value, false, 'default');

      cond = new Condition(false);
      assert.strictEqual(cond.value, false, 'explicit `false`');

      cond = new Condition(true);
      assert.strictEqual(cond.value, true, 'explicit `true`');
    });
  });

  describe('.value', () => {
    it('should get a value that was previously set', () => {
      const cond = new Condition();

      cond.value = false;
      assert.strictEqual(cond.value, false);

      cond.value = true;
      assert.strictEqual(cond.value, true);

      cond.value = false;
      assert.strictEqual(cond.value, false);
    });

    it('should trigger `true` waiters when set from `false` to `true`', async () => {
      const cond = new Condition(false);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenTrue();
        triggered = true;
      })();

      cond.value = true;
      assert.isFalse(triggered);
      await waitDone;
      assert.isTrue(triggered);
    });

    it('should trigger `false` waiters when set from `true` to `false`', async () => {
      const cond = new Condition(true);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenFalse();
        triggered = true;
      })();

      cond.value = false;
      assert.isFalse(triggered);
      await waitDone;
      assert.isTrue(triggered);
    });
  });

  describe('onOff()', () => {
    it('should leave the value `false`', () => {
      const cond = new Condition(false);

      cond.onOff();
      assert.strictEqual(cond.value, false);

      cond.value = true;
      cond.onOff();
      assert.strictEqual(cond.value, false);
    });

    it('should trigger `true` waiters when value started out `false`', async () => {
      const cond = new Condition(false);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenTrue();
        triggered = true;
      })();

      cond.onOff();
      assert.isFalse(triggered);
      await waitDone;
      assert.isTrue(triggered);
    });

    it('should trigger `false` waiters when value started out `true`', async () => {
      const cond = new Condition(true);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenTrue();
        triggered = true;
      })();

      cond.onOff();
      assert.isFalse(triggered);
      await waitDone;
      assert.isTrue(triggered);
    });
  });

  describe('whenFalse()', () => {
    it('should trigger immediately if the value is already `false`', async () => {
      const cond = new Condition(false);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenFalse();
        triggered = true;
      })();

      await waitDone;
      assert.isTrue(triggered);
    });
  });

  describe('whenTrue()', () => {
    it('should trigger immediately if the value is already `true`', async () => {
      const cond = new Condition(true);
      let triggered = false;

      const waitDone = (async () => {
        await cond.whenTrue();
        triggered = true;
      })();

      await waitDone;
      assert.isTrue(triggered);
    });
  });
});
