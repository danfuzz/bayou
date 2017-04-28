// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ChaiAsPromised from 'chai-as-promised';
import Chai from 'chai';
import { describe, it } from 'mocha';

import { PromDelay } from 'util-common';

Chai.use(ChaiAsPromised);
import { assert } from 'chai';

describe('util-common/PromDelay', () => {
  describe('#delay(delayMSec)', () => {
    it('should eventually resolve to true', () => {
      assert.isFulfilled(PromDelay.resolve(10));
      assert.becomes(PromDelay.resolve(10), true);
    });
  });

  describe('#delay(delayMSec, value)', () => {
    it('should eventually resolve to the supplied value', () => {
      assert.isFulfilled(PromDelay.resolve(10, 'floopty'));
      assert.becomes(PromDelay.resolve(10, 'floopty'), 'floopty');
    });
  });

  describe('#reject(delayMSec, reason)', () => {
    it('should eventually be rejected with the specified reason', () => {
      assert.isRejected(PromDelay.reject(10, 'you smell'));
      assert.isRejected(PromDelay.reject(10, 'you smell'), /^you smell$/);
    });
  });
});
