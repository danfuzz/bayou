// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { CommonBase } from '@bayou/util-common';

describe('@bayou/util-core/CommonBase', () => {
  describe('check()', () => {
    it('returns the supplied value if it is an instance of the class or a subclass', () => {
      class Subclass1 extends CommonBase {
        fiat() { /*empty*/ }
      }

      class Subclass2 extends Subclass1 {
        lux() { /*empty*/ }
      }

      const base      = new CommonBase();
      const subclass1 = new Subclass1();
      const subclass2 = new Subclass2();

      assert.strictEqual(CommonBase.check(base), base);
      assert.strictEqual(CommonBase.check(subclass1), subclass1);
      assert.strictEqual(CommonBase.check(subclass2), subclass2);
      assert.strictEqual(Subclass1.check(subclass1), subclass1);
      assert.strictEqual(Subclass1.check(subclass2), subclass2);
    });

    it('throws an Error if the supplied value is not an instance of the class or a subclass', () => {
      class Subclass extends CommonBase {
        fiat() { /*empty*/ }
      }

      assert.throws(() => CommonBase.check(new Map()));
      assert.throws(() => Subclass.check(new CommonBase()));
    });
  });

  describe('coerce()', () => {
    it('calls through to `_impl_coerce()`', () => {
      let gotValue = null;
      class HasCoerce extends CommonBase {
        static _impl_coerce(value) {
          gotValue = value;
          return new HasCoerce();
        }
      }

      const value = HasCoerce.coerce(123);
      assert.instanceOf(value, HasCoerce);
      assert.strictEqual(gotValue, 123);
    });

    it('rejects a `_impl_coerce()` result that is not an instance of the class', () => {
      class HasCoerce extends CommonBase {
        static _impl_coerce(value) {
          return value;
        }
      }

      assert.throws(() => { HasCoerce.coerce(123); });
    });
  });

  describe('coerceOrNull()', () => {
    it('calls through to `_impl_coerce()` if there is no `_impl_coerceOrNull()`', () => {
      let gotValue = null;
      class HasCoerce extends CommonBase {
        static _impl_coerce(value) {
          gotValue = value;
          return new HasCoerce();
        }
      }

      const value = HasCoerce.coerceOrNull(123);
      assert.instanceOf(value, HasCoerce);
      assert.strictEqual(gotValue, 123);
    });

    it('calls through to `_impl_coerce()` if there is no `_impl_coerceOrNull()` and converts a throw into a `null`', () => {
      class HasCoerce extends CommonBase {
        static _impl_coerce(value_unused) {
          throw new Error('oy');
        }
      }

      const value = HasCoerce.coerceOrNull(123);
      assert.isNull(value);
    });

    it('calls through to `_impl_coerceOrNull()`', () => {
      let gotValue = null;
      class HasCoerce extends CommonBase {
        static _impl_coerceOrNull(value) {
          gotValue = value;
          return new HasCoerce();
        }
      }

      const value = HasCoerce.coerceOrNull(123);
      assert.instanceOf(value, HasCoerce);
      assert.strictEqual(gotValue, 123);
    });

    it('calls through to `_impl_coerceOrNull()` and accepts a `null` return value', () => {
      class HasCoerce extends CommonBase {
        static _impl_coerceOrNull(value_unused) {
          return null;
        }
      }

      const value = HasCoerce.coerceOrNull(123);
      assert.isNull(value);
    });

    it('rejects a `_impl_coerceOrNull()` result that is neither `null` nor an instance of the class', () => {
      class HasCoerce extends CommonBase {
        static _impl_coerceOrNull(value) {
          return value;
        }
      }

      assert.throws(() => { HasCoerce.coerceOrNull(123); });
    });
  });

  describe('mixInto()', () => {
    it('adds its properties to the supplied class', () => {
      class NearlyEmptyClass {
        fiat() { /*empty*/ }
      }

      assert.notProperty(NearlyEmptyClass, 'check');
      assert.notProperty(NearlyEmptyClass, 'coerce');
      assert.notProperty(NearlyEmptyClass, 'mixInto');
      assert.notProperty(NearlyEmptyClass.prototype, '_mustOverride');

      CommonBase.mixInto(NearlyEmptyClass);

      assert.property(NearlyEmptyClass, 'check');
      assert.property(NearlyEmptyClass, 'coerce');
      assert.property(NearlyEmptyClass, 'mixInto');
      assert.property(NearlyEmptyClass.prototype, '_mustOverride');
    });
  });
});
