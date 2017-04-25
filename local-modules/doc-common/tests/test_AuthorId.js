// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { AuthorId } from 'doc-common';

describe('doc-common/AuthorId', () => {
  describe('#check', () => {
    it('should reject null values by default', () => {
      assert.throws(() => AuthorId.check(null));
    });

    it('should reject null values if nullOk == false', () => {
      assert.throws(() => AuthorId.check(null, false));
    });

    it('should accept null values if nullOk == true', () => {
      assert.doesNotThrow(() => AuthorId.check(null, true));
      assert.isNull(AuthorId.check(null, true));
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
      assert.doesNotThrow(() => AuthorId.check('001122-445566778899AAbb_ddeeff'));
    });
  });
});
