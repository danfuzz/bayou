// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { AuthorId } from 'doc-common';

describe('doc-common/AuthorId', () => {
  describe('check()', () => {
    it('should reject `null`', () => {
      assert.throws(() => AuthorId.check(null));
    });

    it('should reject non-string or empty string values', () => {
      assert.throws(() => AuthorId.check(37));
      assert.throws(() => AuthorId.check(''));
      assert.throws(() => AuthorId.check({}));
      assert.throws(() => AuthorId.check(false));
    });

    it('should reject strings in the wrong format', () => {
      assert.throws(() => AuthorId.check('this better not work!'));
    });

    it('should accept 32-character strings comprised of a-zA-Z0-9_-', () => {
      const value = '001122-445566778899AAbb_ddeeff';
      assert.strictEqual(AuthorId.check(value), value);
    });
  });

  describe('orNull()', () => {
    it('should accept `null`', () => {
      assert.isNull(AuthorId.orNull(null));
    });

    it('should reject non-string or empty string values', () => {
      assert.throws(() => AuthorId.orNull(37));
      assert.throws(() => AuthorId.orNull(''));
      assert.throws(() => AuthorId.orNull({}));
      assert.throws(() => AuthorId.orNull(false));
    });

    it('should reject strings in the wrong format', () => {
      assert.throws(() => AuthorId.orNull('this better not work!'));
    });

    it('should accept 32-character strings comprised of a-zA-Z0-9_-', () => {
      const value = '001122-445566778899AAbb_ddeeff';
      assert.strictEqual(AuthorId.orNull(value), value);
    });
  });
});
