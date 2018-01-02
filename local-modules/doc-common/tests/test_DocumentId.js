// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DocumentId } from 'doc-common';

describe('doc-common/DocumentId', () => {
  describe('check()', () => {
    it('should reject `null`', () => {
      assert.throws(() => DocumentId.check(null));
    });

    it('should reject non-string or empty string values', () => {
      assert.throws(() => DocumentId.check(37));
      assert.throws(() => DocumentId.check(''));
      assert.throws(() => DocumentId.check({}));
      assert.throws(() => DocumentId.check(false));
    });

    it('should reject strings in the wrong format', () => {
      assert.throws(() => DocumentId.check('this better not work!'));
    });

    it('should accept 32-character strings comprised of a-zA-Z0-9_-', () => {
      const value = '001122-445566778899AAbb_ddeeff';
      assert.strictEqual(DocumentId.check(value), value);
    });
  });
});
