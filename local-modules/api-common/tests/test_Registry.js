// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ItemCodec } from 'api-common';

// The class being tested here isn't exported from the module, so we import it
// by path.
import Registry from 'api-common/Registry';

class RegistryTestApiObject {
  constructor() {
    this.initialized = true;
  }

  static get API_NAME() {
    return 'RegistryTestApiObject';
  }

  toApi() {
    return ['fake argument', 0, 1, 2];
  }

  static fromApi(arguments_unused) {
    return new RegistryTestApiObject();
  }
}

class NoApiName {
  toApi() {
    return 'NoApiName!';
  }

  static fromApi() {
    return new NoApiName();
  }
}

class NoToApi {
  constructor() {
    this.API_NAME = 'NoToApi';
  }

  static fromApi() {
    return new NoToApi();
  }
}

class NoFromApi {
  constructor() {
    this.API_NAME = 'NoFromApi';
  }

  toApi() {
    return new NoFromApi();
  }
}

describe('api-common/Registry', () => {
  describe('.arrayTag', () => {
    it("should return 'array'", () => {
      const reg = new Registry();
      assert.strictEqual(reg.arrayTag, 'array');
    });
  });

  describe('register(class)', () => {
    it('should require classes with an APP_NAME property, fromName() class method, and toApi() instance method', () => {
      const reg = new Registry();
      assert.throws(() => reg.registerClass(true));
      assert.throws(() => reg.registerClass(37));
      assert.throws(() => reg.registerClass('this better not work!'));
      assert.throws(() => reg.registerClass({}));
      assert.throws(() => reg.registerClass([]));
      assert.throws(() => reg.registerClass(null));
      assert.throws(() => reg.registerClass(undefined));
      assert.throws(() => reg.registerClass(NoApiName));
      assert.throws(() => reg.registerClass(NoToApi));
      assert.throws(() => reg.registerClass(NoFromApi));

      assert.doesNotThrow(() => reg.registerClass(RegistryTestApiObject));
    });
  });

  describe('codecForTag(tag)', () => {
    it('should throw an error if an unregistered tag is requested', () => {
      const reg = new Registry();
      assert.throws(() => reg.codecForTag('florp'));
    });

    it('should return the named codec if it is registered', () => {
      const reg = new Registry();
      const itemCodec = new ItemCodec('florp', Boolean, null, () => 0, () => 0);

      reg.registerCodec(itemCodec);

      const testCodec = reg.codecForTag('florp');
      assert.strictEqual(testCodec, itemCodec);
    });
  });
});
