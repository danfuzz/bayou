// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DEFAULT_DOCUMENT } from 'hooks-server';
import { BodyDelta } from 'doc-common';
import { DataUtil } from 'util-common';

describe('hooks-server/DEFAULT_DOCUMENT', () => {
  it('should be a deep-frozen data value', () => {
    const doc = DEFAULT_DOCUMENT;

    assert.isFrozen(doc);

    const deepFrozen = DataUtil.deepFreeze(doc);

    assert.strictEqual(deepFrozen, doc);
  });

  it('should be an array-of-arrays', () => {
    const doc = DEFAULT_DOCUMENT;

    assert.isArray(doc);
    for (const a of doc) {
      assert.isArray(a);
    }
  });

  it('should be usable to construct a `BodyDelta` for which `isDocument()` is `true`', () => {
    const doc = DEFAULT_DOCUMENT;

    const result = BodyDelta.fromOpArgArray(doc);
    assert.isTrue(result.isDocument());
  });
});
