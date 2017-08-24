// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Delay } from 'promise-util';

describe('util-common/Delay', () => {
  describe('delay(delayMSec)', () => {
    it('should eventually resolve to true', () => {
      assert.isFulfilled(Delay.resolve(10));
      assert.becomes(Delay.resolve(10), true);
    });
  });

  describe('delay(delayMSec, value)', () => {
    it('should eventually resolve to the supplied value', () => {
      assert.isFulfilled(Delay.resolve(10, 'floopty'));
      assert.becomes(Delay.resolve(10, 'floopty'), 'floopty');
    });
  });

  describe('reject(delayMSec, reason)', () => {
    it('should eventually be rejected with the specified reason', () => {
      assert.isRejected(Delay.reject(10, 'you smell'));
      assert.isRejected(Delay.reject(10, 'you smell'), /^you smell$/);
    });
  });
});
