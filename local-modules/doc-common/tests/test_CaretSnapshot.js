// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretDelta, CaretSnapshot } from 'doc-common';

const caret1 = new Caret('session-1', 1, 0, '#111111');
const caret2 = new Caret('session-2', 2, 6, '#222222');

describe('doc-common/CaretSnapshot', () => {
  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap = new CaretSnapshot(123, 234, [caret1, caret2]);
      const result = snap.diff(snap);

      assert.instanceOf(result, CaretDelta);
      assert.strictEqual(result.revNum, snap.revNum);
      assert.deepEqual(result.ops, []);
    });
  });
});
