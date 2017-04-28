// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TInt } from 'typecheck';

describe('typecheck.TInt', () => {
  describe('#check(value)', () => {
    it('should return the provided value when passed a safe integer', () => {
      const value = 9823674;

      assert.doesNotThrow(() => TInt.check(value));
      assert.strictEqual(TInt.check(value), value, 'returns same value it was passed when valid');
    });

    it('should throw an Error when passed an unsafe integer', () => {
      assert.throws(() => TInt.check(3.1));
    });

    it('should throw an Error when passed a non-number value', () => {
      assert.throws(() => TInt.check('this better not work'));
    });
  });

  describe('#min(value, inclusiveMinimum)', () => {
    it('should allow value >= inclusiveMinimum', () => {
      assert.doesNotThrow(() => TInt.min(11, 3));
    });

    it('should throw an error when value < inclusiveMinimum', () => {
      assert.throws(() => TInt.min(2, 3));
    });
  });

  describe('#range(value, inclusiveMinimum, exclusiveMaximum)', () => {
    it('should allow inclusiveMinimum <= value < exclusiveMaximum', () => {
      assert.doesNotThrow(() => TInt.range(11, 3, 27));
    });

    it('should not throw an error when value = inclusiveMinimum', () => {
      assert.doesNotThrow(() => TInt.range(3, 3, 27));
    });

    it('should throw an error when value < inclusiveMinimum', () => {
      assert.throws(() => TInt.range(2, 3, 27));
    });

    it('should throw an error when value = exclusiveMaximum', () => {
      assert.throws(() => TInt.range(27, 3, 27));
    });

    it('should throw an error when value > exclusiveMaximum', () => {
      assert.throws(() => TInt.range(37, 3, 27));
    });
  });

  describe('#rangeInc(value, inclusiveMinimum, inclusiveMaximum)', () => {
    it('should allow inclusiveMinimum <= value <= inclusiveMaximum', () => {
      assert.doesNotThrow(() => TInt.rangeInc(11, 3, 27));
    });

    it('should throw an error when value < inclusiveMinimum', () => {
      assert.throws(() => TInt.rangeInc(2, 3, 27));
    });

    it('should not throw an error when value = inclusiveMaximum', () => {
      assert.doesNotThrow(() => TInt.rangeInc(27, 3, 27));
    });

    it('should throw an error when value > inclusiveMaximum', () => {
      assert.throws(() => TInt.rangeInc(37, 3, 27));
    });
  });

  describe('#unsignedByte(value)', () => {
    it('should allow integer values from [0..255]', () => {
      assert.doesNotThrow(() => TInt.unsignedByte(0));
      assert.doesNotThrow(() => TInt.unsignedByte(128));
      assert.doesNotThrow(() => TInt.unsignedByte(255));
    });

    it('should throw an error when value is outside [0..255]', () => {
      assert.throws(() => TInt.unsgignedByte(-1));
      assert.throws(() => TInt.unsgignedByte(256));
    });
  });
});
