// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';

import { FrozenDelta } from 'doc-common';

describe('doc-common/FrozenDelta', () => {
  describe('.EMPTY', () => {
    it('should return an empty, frozen Delta', () => {
      const empty = FrozenDelta.EMPTY;

      assert.instanceOf(empty, FrozenDelta);
      assert.isFrozen(empty);
      assert.equal(empty['ops'].length, 0);
      assert.isTrue(FrozenDelta.isEmpty(empty));
    });
  });

  describe('#isEmpty', () => {
    it('should return true for an empty Delta or subclass', () => {
      const emptyDelta = new Delta();

      assert.isTrue(FrozenDelta.isEmpty(emptyDelta));
    });

    it('should return true for null and undefined', () => {
      assert.isTrue(FrozenDelta.isEmpty(null));
      assert.isTrue(FrozenDelta.isEmpty(undefined));
    });

    it('should return true for empty Delta-like objects', () => {
      const emptyObject = { ops: [] };

      assert.isTrue(FrozenDelta.isEmpty(emptyObject));
    });

    it('should return true for empty Delta-like objects', () => {
      const emptyObject = { ops: [] };

      assert.isTrue(FrozenDelta.isEmpty(emptyObject));
    });

    it('should return true for arrays', () => {
      assert.isTrue(FrozenDelta.isEmpty([]));
    });

    it('should throw an Error for any other value', () => {
      assert.throws(() => FrozenDelta.isEmpty(37));
      assert.throws(() => FrozenDelta.isEmpty(true));
      assert.throws(() => FrozenDelta.isEmpty(''));
      assert.throws(() => FrozenDelta.isEmpty('this better not work!'));
      assert.throws(() => FrozenDelta.isEmpty({}));
      assert.throws(() => FrozenDelta.isEmpty({ ops: [1, 2, 3] }));
      assert.throws(() => FrozenDelta.isEmpty(function foo() { /* */ }));
    });
  });

  describe('#isDocument(doc)', () => {
    it('should return true if all ops are insert', () => {
      const insertOps = [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }];
      const document = FrozenDelta.coerce(insertOps);

      assert.isTrue(document.isDocument());
    });

    it('should return false if any ops are not insert', () => {
      const insertOps = [{ retain: 5 }, { insert: '\n' }, { insert: 'line 2' }];
      const document = FrozenDelta.coerce(insertOps);

      assert.isFalse(document.isDocument());
    });
  });

  describe('#isEmpty()', () => {
    it('should return true if the Delta has no ops', () => {
      assert.isTrue(FrozenDelta.EMPTY.isEmpty());
    });

    it('should return false if the Delta has any ops', () => {
      const insertOps = [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }];
      const document = FrozenDelta.coerce(insertOps);

      assert.isFalse(document.isEmpty());
    });
  });
});
