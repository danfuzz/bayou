// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { AuthorId } from '@bayou/ot-common';

/** {array<*>} Array of non-strings. */
const NON_STRINGS = [
  undefined,
  null,
  false,
  true,
  1,
  [],
  {},
  ['abc'],
  [123],
  { x: 'abc' },
  new Map()
];

describe('@bayou/ot-common/AuthorId', () => {
  describe('check()', () => {
    it('should throw an error given a non-string argument', () => {
      for (const id of NON_STRINGS) {
        assert.throws(() => AuthorId.check(id), /badValue/, id);
      }
    });

    it('should call through to `config-common.Ids.isAuthorId()` to validate strings', () => {
      // **TODO:** The check for acceptance depends on the configuration point
      // `config-common.Ids`. The best we can do here is mock that out and make
      // sure it's called, but as yet we don't have a standard way to do that
      // sort of thing, so we're punting for now.
      assert.isTrue(true);
    });
  });

  describe('orNull()', () => {
    it('should accept `null`', () => {
      assert.isNull(AuthorId.orNull(null));
    });

    it('should throw an error given a non-null non-string argument', () => {
      for (const id of NON_STRINGS) {
        if (id !== null) {
          assert.throws(() => AuthorId.orNull(id), /badValue/, id);
        }
      }
    });

    it('should call through to `config-common.Ids` to validate strings', () => {
      // **TODO:** See comment above on the trouble testing this.
      assert.isTrue(true);
    });
  });
});
