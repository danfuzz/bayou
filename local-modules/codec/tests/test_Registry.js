// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ItemCodec } from 'codec';

// The class being tested here isn't exported from the module, so we import it
// by path.
import Registry from 'codec/Registry';

class RegistryTestApiObject {
  constructor() {
    this.initialized = true;
  }

  static get CODEC_TAG() {
    return 'RegistryTestApiObject';
  }

  toCodecArgs() {
    return ['fake argument', 0, 1, 2];
  }

  static fromCodecArgs(arguments_unused) {
    return new RegistryTestApiObject();
  }
}

class NoCodecTag {
  toCodecArgs() {
    return 'NoCodecTag!';
  }

  static fromCodecArgs() {
    return new NoCodecTag();
  }
}

class NoToCodecArgs {
  constructor() {
    this.CODEC_TAG = 'NoToCodecArgs';
  }

  static fromCodecArgs() {
    return new NoToCodecArgs();
  }
}

class NoFromCodecArgs {
  constructor() {
    this.CODEC_TAG = 'NoFromCodecArgs';
  }

  toCodecArgs() {
    return new NoFromCodecArgs();
  }
}

describe('api-common/Registry', () => {
  describe('register(class)', () => {
    it('should accept a class with all salient properties', () => {
      const reg = new Registry();
      assert.doesNotThrow(() => reg.registerClass(RegistryTestApiObject));
    });

    it('should allow classes without `CODEC_TAG` or `fromCodecArgs()`', () => {
      const reg = new Registry();
      assert.doesNotThrow(() => reg.registerClass(NoCodecTag));
      assert.doesNotThrow(() => reg.registerClass(NoFromCodecArgs));
    });

    it('should reject a class without `toCodecArgs()`', () => {
      const reg = new Registry();
      assert.throws(() => reg.registerClass(NoToCodecArgs));
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

  describe('codecForPayload(payload)', () => {
    it('should throw an error if an unregistered tag is requested', () => {
      const reg = new Registry();
      assert.throws(() => reg.codecForPayload(['florp']));

      // Throws because `Symbol` wasn't a registered type.
      assert.throws(() => reg.codecForPayload(Symbol('foo')));
    });

    it('should return the named codec if it is registered', () => {
      const reg = new Registry();
      const itemCodec = new ItemCodec('florp', Boolean, null, () => 0, () => 0);

      reg.registerCodec(itemCodec);

      const testCodec = reg.codecForPayload(['florp']);
      assert.strictEqual(testCodec, itemCodec);
    });
  });
});
