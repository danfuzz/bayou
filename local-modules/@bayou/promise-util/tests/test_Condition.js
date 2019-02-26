// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Condition } from '@bayou/promise-util';

describe('@bayou/promise-util/Condition', () => {
  describe('constructor()', () => {
    it('takes on the default value', () => {
      const cond = new Condition();
      assert.strictEqual(cond.value, false, 'default');
    });
  });

  describe('constructor(value)', () => {
    it('takes on the constructed value', () => {
      let cond;

      cond = new Condition(false);
      assert.strictEqual(cond.value, false, 'explicit `false`');

      cond = new Condition(true);
      assert.strictEqual(cond.value, true, 'explicit `true`');
    });
  });

  describe('.value', () => {
    it('gets the value that was previously set', () => {
      const cond1 = new Condition(false);

      cond1.value = false;
      assert.strictEqual(cond1.value, false);

      cond1.value = true;
      assert.strictEqual(cond1.value, true);

      cond1.value = false;
      assert.strictEqual(cond1.value, false);

      const cond2 = new Condition(true);

      cond2.value = false;
      assert.strictEqual(cond2.value, false);

      cond2.value = true;
      assert.strictEqual(cond2.value, true);
    });

    it('triggers `true` waiters when set from `false` to `true`', async () => {
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

    it('triggers `false` waiters when set from `true` to `false`', async () => {
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
    it('leaves the value `false`', () => {
      const cond = new Condition(false);

      cond.onOff();
      assert.strictEqual(cond.value, false);

      cond.value = true;
      cond.onOff();
      assert.strictEqual(cond.value, false);
    });

    it('triggers `true` waiters when value started out `false`', async () => {
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

    it('triggers `false` waiters when value started out `true`', async () => {
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
    it('triggers immediately if the value is already `false`', async () => {
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
    it('triggers immediately if the value is already `true`', async () => {
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
