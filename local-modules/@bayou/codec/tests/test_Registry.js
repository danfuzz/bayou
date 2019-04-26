// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ConstructorCall, ItemCodec, Registry } from '@bayou/codec';

class RegistryTestClass {
  constructor() {
    this.initialized = true;
  }

  static get CODEC_TAG() {
    return 'RegistryTestClass';
  }

  deconstruct() {
    return ['fake argument', 0, 1, 2];
  }
}

describe('@bayou/codec/Registry', () => {
  describe('register()', () => {
    it('should accept a class with all salient properties', () => {
      const reg = new Registry();
      assert.doesNotThrow(() => reg.registerClass(RegistryTestClass));
    });

    it('should allow classes without `CODEC_TAG`', () => {
      class NoCodecTag {
        deconstruct() {
          return 'NoCodecTag!';
        }
      }

      const reg = new Registry();
      assert.doesNotThrow(() => reg.registerClass(NoCodecTag));
    });

    it('should reject a class without `deconstruct()`', () => {
      class NoDeconstruct {
        get CODEC_TAG() {
          return 'NoDeconstruct';
        }
      }

      const reg = new Registry();
      assert.throws(() => reg.registerClass(NoDeconstruct));
    });

    it('should reject non-classes', () => {
      const reg = new Registry();
      assert.throws(() => reg.registerClass(true));
      assert.throws(() => reg.registerClass(37));
      assert.throws(() => reg.registerClass('this better not work!'));
      assert.throws(() => reg.registerClass({}));
      assert.throws(() => reg.registerClass([]));
      assert.throws(() => reg.registerClass(null));
      assert.throws(() => reg.registerClass(undefined));
    });
  });

  describe('codecForPayload()', () => {
    it('should throw an error if an unregistered tag is requested', () => {
      const reg = new Registry();

      // Throws because `Boop` isn't a registered class.
      assert.throws(() => reg.codecForPayload(new ConstructorCall('Boop', 1, 2, 3)));

      // Throws because `object` (plain object) wasn't a registered type.
      assert.throws(() => reg.codecForPayload({ florp: [1, 2, 3] }));

      // Throws because `symbol` wasn't a registered type.
      assert.throws(() => reg.codecForPayload(Symbol('foo')));
    });

    it('returns the named codec if it is registered', () => {
      const reg       = new Registry();
      const itemCodec = new ItemCodec('Boop', Boolean, null, () => 0, () => 0);

      reg.registerCodec(itemCodec);

      const testCodec = reg.codecForPayload(ConstructorCall.from('Boop', 1, 2, 3));
      assert.strictEqual(testCodec, itemCodec);
    });

    it('returns the codec for a special type if it is registered', () => {
      const reg       = new Registry();
      const type      = 'symbol';
      const itemCodec = new ItemCodec(ItemCodec.tagFromType(type), type, null, () => 0, () => 0);

      reg.registerCodec(itemCodec);

      const testCodec = reg.codecForPayload(Symbol('x'));
      assert.strictEqual(testCodec, itemCodec);
    });
  });
});
