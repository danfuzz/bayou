// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codec } from 'codec';
import { Timeouts, Timestamp } from 'doc-common';
import { MockChange, MockDelta, MockOp, MockSnapshot } from 'doc-common/mocks';
import { BaseControl, FileAccess } from 'doc-server';
import { MockControl } from 'doc-server/mocks';
import { TransactionSpec } from 'file-store';
import { MockFile } from 'file-store/mocks';

describe('doc-server/BaseControl', () => {
  /** {FileAccess} Convenient instance of `FileAccess`. */
  const FILE_ACCESS = new FileAccess(Codec.theOne, new MockFile('blort'));

  describe('.changeClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.changeClass;
      assert.strictEqual(result, MockSnapshot.changeClass);
    });
  });

  describe('.deltaClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.deltaClass;
      assert.strictEqual(result, MockSnapshot.deltaClass);
    });
  });

  describe('.pathPrefix', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.pathPrefix;
      assert.strictEqual(result, '/mock_control');
    });

    it('should reject an improper subclass choice', () => {
      class HasBadPrefix extends BaseControl {
        static get _impl_pathPrefix() {
          return '//invalid/path_string!';
        }
      }

      assert.throws(() => HasBadPrefix.pathPrefix);
    });

    it('should only ever ask the subclass once', () => {
      class GoodControl extends BaseControl {
        static get _impl_pathPrefix() {
          this.count++;
          return '/blort';
        }
      }

      GoodControl.count = 0;
      assert.strictEqual(GoodControl.pathPrefix, '/blort');
      assert.strictEqual(GoodControl.pathPrefix, '/blort');
      assert.strictEqual(GoodControl.pathPrefix, '/blort');
      assert.strictEqual(GoodControl.pathPrefix, '/blort');
      assert.strictEqual(GoodControl.pathPrefix, '/blort');

      assert.strictEqual(GoodControl.count, 1);
    });
  });

  describe('.snapshotClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.snapshotClass;
      assert.strictEqual(result, MockSnapshot);
    });

    it('should reject an improper subclass choice', () => {
      class HasBadSnapshot extends BaseControl {
        static get _impl_snapshotClass() {
          return Object;
        }
      }

      assert.throws(() => HasBadSnapshot.snapshotClass);
    });

    it('should only ever ask the subclass once', () => {
      class GoodControl extends BaseControl {
        static get _impl_snapshotClass() {
          this.count++;
          return MockSnapshot;
        }
      }

      GoodControl.count = 0;
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);

      assert.strictEqual(GoodControl.count, 1);
    });
  });

  describe('pathForChange()', () => {
    it('should return an appropriate path given a valid argument', () => {
      function test(value) {
        const expect = `${MockControl.pathPrefix}/change/${value}`;
        assert.strictEqual(MockControl.pathForChange(value), expect);
      }

      test(0);
      test(1);
      test(10);
      test(100000914);
    });

    it('should reject invalid arguments', () => {
      function test(value) {
        assert.throws(() => MockControl.pathForChange(value), /bad_value/);
      }

      test(-1);
      test(0.01);
      test(null);
      test(undefined);
      test(false);
      test([10]);
      test(new Map());
    });
  });

  describe('constructor()', () => {
    it('should accept a `FileAccess` and reflect it in the inherited getters', () => {
      const fa     = FILE_ACCESS;
      const result = new MockControl(fa, 'boop');

      assert.strictEqual(result.codec,      fa.codec);
      assert.strictEqual(result.file,       fa.file);
      assert.strictEqual(result.fileAccess, fa);
      assert.strictEqual(result.fileCodec,  fa.fileCodec);

      // `log` will be different, because it adds the `logLabel` as a prefix.
      assert.notStrictEqual(result.log, fa.log);
    });

    it('should reject non-`FileAccess` arguments', () => {
      assert.throws(() => new MockControl(null,      'boop'));
      assert.throws(() => new MockControl({ x: 10 }, 'boop'));
    });
  });

  describe('.initSpec', () => {
    it('should be a `TransactionSpec`', () => {
      const result = new MockControl(FILE_ACCESS, 'florp').initSpec;
      assert.instanceOf(result, TransactionSpec);
    });
  });

  describe('currentRevNum()', () => {
    it('should perform an appropriate transaction, and use the result', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(Codec.theOne, file);
      const control    = new MockControl(fileAccess, 'boop');

      let gotSpec = null;

      file._impl_transact = (spec) => {
        gotSpec = spec;
        throw new Error('to_be_expected');
      };

      await assert.isRejected(control.currentRevNum(), /to_be_expected/);

      assert.instanceOf(gotSpec, TransactionSpec);

      const ops1 = gotSpec.opsWithName('checkPathPresent');
      const ops2 = gotSpec.opsWithName('readPath');

      assert.strictEqual(gotSpec.ops.length, 2);
      assert.lengthOf(ops1, 1);
      assert.lengthOf(ops2, 1);
      assert.strictEqual(ops1[0].props.storagePath, '/mock_control/revision_number');
      assert.strictEqual(ops2[0].props.storagePath, '/mock_control/revision_number');
    });

    it('should use the result of the transaction it performed', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(Codec.theOne, file);
      const control    = new MockControl(fileAccess, 'boop');

      file._impl_transact = (spec_unused) => {
        return {
          revNum:    90909,
          newRevNum: null,
          paths:     null,
          data: new Map(Object.entries({
            '/mock_control/revision_number': Codec.theOne.encodeJsonBuffer(1234)
          }))
        };
      };

      await assert.eventually.strictEqual(control.currentRevNum(), 1234);
    });

    it('should reject improper transaction results', async () => {
      async function test(value) {
        const file       = new MockFile('blort');
        const codec      = Codec.theOne;
        const fileAccess = new FileAccess(codec, file);
        const control    = new MockControl(fileAccess, 'boop');

        file._impl_transact = (spec_unused) => {
          return {
            revNum:    90909,
            newRevNum: null,
            paths:     null,
            data: new Map(Object.entries({
              '/mock_control/revision_number': codec.encodeJsonBuffer(value)
            }))
          };
        };

        await assert.isRejected(control.currentRevNum(), /^bad_value/);
      }

      await test(null);
      await test(false);
      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });
  });

  describe('getChange()', () => {
    describe('when given a valid-typed argument', () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let gotStart  = null;
      let gotEnd    = null;

      control.getChangeRange = async (start, end) => {
        gotStart = start;
        gotEnd   = end;
        return ['foomp'];
      };

      it('should pass appropriate arguments to `getChangeRange()`', async () => {
        async function test(n) {
          await control.getChange(n);
          assert.strictEqual(gotStart, n);
          assert.strictEqual(gotEnd,   n + 1);
        }

        await test(0);
        await test(1);
        await test(914);
      });

      it('should return the first element of the return value from `getChangeRange()`', async () => {
        const result = await control.getChange(123);
        assert.strictEqual(result, 'foomp');
      });
    });

    it('should promptly reject blatantly invalid `revNum` values', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.getChangeRange = async (start_unused, end_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        assert.isRejected(control.getChange(value), /^bad_value/);
      }

      await test(undefined);
      await test(null);
      await test(-1);
      await test(0.5);
      await test('123');
      await test({ x: 123 });
    });
  });

  describe('getChangeAfter()', () => {
    it('should call through to `currentRevNum()` before anything else', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('Oy!');
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getChangeAfter(0), /^Oy!/);
    });

    it('should check the validity of `baseRevNum` against the response from `currentRevNum()`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getChangeAfter(11), /^bad_value/);
    });

    it('should reject blatantly invalid `baseRevNum` values', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.getChangeAfter(value), /^bad_value/);
      }

      await test(null);
      await test(undefined);
      await test(false);
      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });

    it('should appropriately clamp `timeoutMsec` values', async () => {
      let gotTimeout = null;

      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec, currentRevNum_unused) => {
        gotTimeout = timeoutMsec;
        throw new Error('boop');
      };

      async function test(value, expect) {
        await assert.isRejected(control.getChangeAfter(10, value), /boop/);
        assert.strictEqual(gotTimeout, expect);
      }

      await test(null,                      Timeouts.MAX_TIMEOUT_MSEC);
      await test(0,                         Timeouts.MIN_TIMEOUT_MSEC);
      await test(Timeouts.MAX_TIMEOUT_MSEC, Timeouts.MAX_TIMEOUT_MSEC);
      await test(Timeouts.MIN_TIMEOUT_MSEC, Timeouts.MIN_TIMEOUT_MSEC);

      for (let i = Timeouts.MIN_TIMEOUT_MSEC + 1; i < Timeouts.MAX_TIMEOUT_MSEC; i += 2347) {
        await test(i, i);
      }
    });

    it('should return back a valid non-`null` subclass response', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum, timeoutMsec_unused, currentRevNum) => {
        const rev = currentRevNum + 1;
        return new MockChange(rev, [new MockOp('x', baseRevNum, rev)]);
      };

      const result = await control.getChangeAfter(5);
      assert.instanceOf(result, MockChange);
      assert.strictEqual(result.revNum, 11);
      assert.deepEqual(result.delta.ops, [new MockOp('x', 5, 11)]);
    });

    it('should convert a `null` subclass response to a `revision_not_available` error', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum_unused) => {
        return null;
      };

      await assert.isRejected(control.getChangeAfter(1), /^revision_not_available/);
    });

    it('should reject a non-change subclass response', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };

      async function test(value) {
        control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum_unused) => {
          return value;
        };

        await assert.isRejected(control.getChangeAfter(1), /^bad_value/);
      }

      await test(false);
      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });

    it('should reject a change response that has a `timestamp`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum) => {
        return new MockChange(currentRevNum + 1, [], Timestamp.MIN_VALUE);
      };

      await assert.isRejected(control.getChangeAfter(1), /^bad_value/);
    });

    it('should reject a change response that has an `authorId`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getChangeAfter = async (baseRevNum_unused, timeoutMsec_unused, currentRevNum) => {
        return new MockChange(currentRevNum + 1, [], null, 'some_author');
      };

      await assert.isRejected(control.getChangeAfter(1), /^bad_value/);
    });
  });

  describe('getDiff()', () => {
    it('should reject bad arguments', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');

      async function test(base, newer) {
        assert.isRejected(control.getDiff(base, newer), /^bad_value/);
      }

      await test(undefined, 10);
      await test(null,      10);
      await test(false,     10);
      await test('florp',   10);
      await test(-1,        10);
      await test(1.234,     10);

      await test(10, undefined);
      await test(10, null);
      await test(10, false);
      await test(10, 'florp');
      await test(10, -1);
      await test(10, 1.234);

      // Can't pass the same value for both arguments.
      await test(0,  0);
      await test(1,  1);
      await test(37, 37);

      // Second argument has to be higher.
      await test(1,   0);
      await test(123, 122);
      await test(914, 10);
    });

    it('should produce a result in one of the two specified ways', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let reqBase, reqNewer;

      control.getSnapshot = async (revNum) => {
        assert((revNum === reqBase) || (revNum === reqNewer), `Unexpected revNum: ${revNum}`);
        return new MockSnapshot(revNum, [[`snap_blort_${revNum}`]]);
      };

      control.getComposedChanges = async (baseDelta, startInc, endExc, wantDocument) => {
        // Validate how we expect to be called.
        assert.strictEqual(baseDelta, MockDelta.EMPTY);
        assert.strictEqual(startInc, reqBase + 1);
        assert.strictEqual(endExc, reqNewer + 1);
        assert.isFalse(wantDocument);
        return new MockDelta([[`composed_blort_${reqBase}`]]);
      };

      // Counts for each tactic, to make sure both paths are exercised.
      let composedCount = 0;
      let diffCount     = 0;

      async function test(base, newer) {
        reqBase  = base;
        reqNewer = newer;

        const result = await control.getDiff(base, newer);

        assert.instanceOf(result, MockChange);
        assert.strictEqual(result.revNum, newer);
        assert.isNull(result.authorId);
        assert.isNull(result.timestamp);
        assert.isAbove(result.delta.ops.length, 0);

        const ops     = result.delta.ops;
        const op0Name = ops[0].name;

        if (op0Name === `composed_blort_${base}`) {
          composedCount++;
        } else if (op0Name === 'diff_delta') {
          diffCount++;
          assert.lengthOf(ops, 2);
          assert.strictEqual(ops[1].name, `snap_blort_${newer}`);
        } else {
          assert(false, 'Unexpected ops.');
        }
      }

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 10; j++) {
          const base  = i * 37;
          const newer = base + 1 + (j * 29);
          await test(base, newer);
        }
      }

      assert.isAbove(composedCount, 0);
      assert.isAbove(diffCount, 0);
    });
  });

  describe('getSnapshot()', () => {
    it('should call through to `currentRevNum()` before anything else', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('Oy!');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getSnapshot(5), /^Oy!/);
      await assert.isRejected(control.getSnapshot(), /^Oy!/);
    });

    it('should check the validity of a non-`null` `revNum` against the response from `currentRevNum()`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getSnapshot(11), /^bad_value/);
    });

    it('should reject blatantly invalid `revNum` values', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.getSnapshot(value), /^bad_value/);
      }

      await test(false);
      await test(true);
      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });

    it('should return back a valid non-`null` subclass response', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };

      const result = await control.getSnapshot(5);
      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 5);
      assert.deepEqual(result.contents.ops, [new MockOp('x', 5)]);
    });

    it('should use the returned `currentRevNum` when `revNum` is passed asa `null`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 37;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };

      const result = await control.getSnapshot();
      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 37);
      assert.deepEqual(result.contents.ops, [new MockOp('x', 37)]);
    });

    it('should convert a `null` subclass response to a `revision_not_available` error', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        return null;
      };

      await assert.isRejected(control.getSnapshot(1), /^revision_not_available/);
    });

    it('should reject a non-snapshot subclass response', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };

      async function test(value) {
        control._impl_getSnapshot = async (revNum_unused) => {
          return value;
        };

        await assert.isRejected(control.getSnapshot(1), /^bad_value/);
      }

      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });
  });

  describe('update()', () => {
    it('should reject non-change arguments', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('This should not have been called.');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };
      control._impl_update = async (baseSnapshot_unused, change_unused, expectedSnapshot_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.update(value), /^bad_value/);
      }

      await test(null);
      await test(undefined);
      await test(123);
      await test('florp');
      await test(['boop']);
    });

    it('should reject change arguments with invalid fields', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('This should not have been called.');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };
      control._impl_update = async (baseSnapshot_unused, change_unused, expectedSnapshot_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.update(value), /^bad_value/);
      }

      // `0` is not a valid `revNum` for this method.
      await test(new MockChange(0, [], Timestamp.MIN_VALUE));

      // `timestamp` must be present for this method.
      await test(new MockChange(1, []));
    });

    it('should accept an empty change without calling through to the impl', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('This should not have been called.');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };
      control._impl_update = async (baseSnapshot_unused, change_unused, expectedSnapshot_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        const expectRevNum = value.revNum - 1;
        const result = await control.update(value);

        assert.instanceOf(result, MockChange);
        assert.strictEqual(result.revNum, expectRevNum);
        assert.isTrue(result.delta.isEmpty());
        assert.strictEqual(result.timestamp, null);
        assert.strictEqual(result.authorId, null);
      }

      await test(new MockChange(1,  [], Timestamp.MIN_VALUE));
      await test(new MockChange(10, [], Timestamp.MIN_VALUE.addMsec(12345)));
    });

    it('should reject a too-large `revNum` in valid nontrivial cases', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._impl_update = async (baseSnapshot_unused, change_unused, expectedSnapshot_unused) => {
        throw new Error('This should not have been called.');
      };

      const change = new MockChange(12, [new MockOp('abc')], Timestamp.MIN_VALUE);
      await assert.isRejected(control.update(change), /^bad_value/);
    });

    it('should call through to the impl in valid nontrivial cases', async () => {
      const control   = new MockControl(FILE_ACCESS, 'boop');
      let callCount   = 0;
      let gotBase     = 'x';
      let gotChange   = 'x';
      let gotExpected = 'x';

      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._impl_update = async (baseSnapshot, change, expectedSnapshot) => {
        callCount++;
        gotBase     = baseSnapshot;
        gotChange   = change;
        gotExpected = expectedSnapshot;
        return new MockChange(14, [new MockOp('q')]);
      };

      const change = new MockChange(7, [new MockOp('abc')], Timestamp.MIN_VALUE);
      const result = await control.update(change);

      assert.strictEqual(callCount, 1);
      assert.deepEqual(gotBase, new MockSnapshot(6, [new MockOp('x', 6)]));
      assert.strictEqual(gotChange, change);
      assert.deepEqual(gotExpected,
        new MockSnapshot(7, [new MockOp('composed_doc'), new MockOp('abc')]));

      assert.instanceOf(result, MockChange);
      assert.deepEqual(result, new MockChange(14, [new MockOp('q')]));
    });

    it('should retry the impl call if it returns `null`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let callCount = 0;

      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._impl_update = async (baseSnapshot_unused, change_unused, expectedSnapshot_unused) => {
        callCount++;
        if (callCount === 1) {
          return null;
        }
        return new MockChange(14, [new MockOp('florp')]);
      };

      const change = new MockChange(7, [new MockOp('abc')], Timestamp.MIN_VALUE);
      const result = await control.update(change);

      assert.strictEqual(callCount, 2);
      assert.deepEqual(result, new MockChange(14, [new MockOp('florp')]));
    });
  });

  describe('whenRevNum()', () => {
    it('should return promptly if the revision is already available', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(Codec.theOne, file);
      const control    = new MockControl(fileAccess, 'boop');

      file._impl_transact = (spec_unused) => {
        throw new Error('This should not get called.');
      };

      control.currentRevNum = async () => {
        return 37;
      };

      assert.strictEqual(await control.whenRevNum(0), 37);
      assert.strictEqual(await control.whenRevNum(36), 37);
      assert.strictEqual(await control.whenRevNum(37), 37);
    });

    it('should issue transactions until the revision is written', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(Codec.theOne, file);
      const control    = new MockControl(fileAccess, 'boop');

      let revNum = 11;
      control.currentRevNum = async () => {
        return revNum;
      };

      let transactCount = 0;
      file._impl_transact = (spec) => {
        const ops = spec.opsWithName('whenPathNot');

        assert.lengthOf(ops, 1);
        assert.strictEqual(ops[0].props.storagePath, '/mock_control/revision_number');

        transactCount++;
        revNum += 2; // So that the outer call will succeed after two iterations.

        return {
          revNum:    123,
          newRevNum: null,
          data:      null,
          paths:     new Set(['/mock_control/revision_number'])
        };
      };

      const result = await control.whenRevNum(14);
      assert.strictEqual(result, 15);
      assert.strictEqual(transactCount, 2);
    });
  });
});
