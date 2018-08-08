// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { Timeouts } from '@bayou/doc-common';
import { MockChange, MockDelta, MockOp, MockSnapshot } from '@bayou/ot-common/mocks';
import { DurableControl, FileAccess } from '@bayou/doc-server';
import { MockControl } from '@bayou/doc-server/mocks';
import { MockFile } from '@bayou/file-store/mocks';
import { Errors as fileStoreOt_Errors, TransactionSpec } from '@bayou/file-store-ot';
import { Timestamp } from '@bayou/ot-common';
import { TheModule as mocks_TheModule } from '@bayou/ot-common/mocks';
import { Errors, FrozenBuffer } from '@bayou/util-common';

// **Note:** Even though these tests are written in terms of `DurableControl`
// and a subclass thereof, they are limited to testing behavior which is common
// to all control classes. This is why it is labeled as being for `BaseControl`.
describe('@bayou/doc-server/BaseControl', () => {
  /** {Codec} Convenient instance of `Codec`. */
  const CODEC = appCommon_TheModule.makeModelCodec();
  mocks_TheModule.registerCodecs(CODEC.registry);

  /** {FileAccess} Convenient instance of `FileAccess`. */
  const FILE_ACCESS = new FileAccess(CODEC, new MockFile('blort'));

  describe('.changeClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.changeClass;
      assert.strictEqual(result, MockSnapshot.changeClass);
    });
  });

  describe('.changePathPrefix', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.changePathPrefix;
      assert.strictEqual(result, '/mock_control/change');
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
      class HasBadPrefix extends DurableControl {
        static get _impl_pathPrefix() {
          return '//invalid/path_string!';
        }
      }

      assert.throws(() => HasBadPrefix.pathPrefix);
    });

    it('should only ever ask the subclass once', () => {
      class GoodControl extends DurableControl {
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
      class HasBadSnapshot extends DurableControl {
        static get _impl_snapshotClass() {
          return Object;
        }
      }

      assert.throws(() => HasBadSnapshot.snapshotClass);
    });

    it('should only ever ask the subclass once', () => {
      class GoodControl extends DurableControl {
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
        assert.throws(() => MockControl.pathForChange(value), /badValue/);
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

  describe('appendChange()', () => {
    it.skip('should perform an appropriate transaction given a valid change', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      let gotSpec = null;

      file._impl_transact = (spec) => {
        gotSpec = spec;
        throw new Error('to_be_expected');
      };

      await assert.isRejected(control.appendChange(change, 1234), /to_be_expected/);

      assert.instanceOf(gotSpec, TransactionSpec);
      assert.strictEqual(gotSpec.ops.length, 5);

      const ops1 = gotSpec.opsWithName('timeout');
      assert.lengthOf(ops1, 1);
      assert.strictEqual(ops1[0].props.durMsec, 1234);

      const ops2 = gotSpec.opsWithName('checkPathIs');
      assert.lengthOf(ops2, 1);
      assert.strictEqual(ops2[0].props.storagePath, '/mock_control/revision_number');

      const ops3 = gotSpec.opsWithName('checkPathAbsent');
      assert.strictEqual(ops3[0].props.storagePath, '/mock_control/change/99');

      const ops4 = gotSpec.opsWithName('writePath');
      assert.lengthOf(ops4, 2);

      const paths = ops4.map(op => op.props.storagePath);
      assert.sameMembers(paths, ['/mock_control/revision_number', '/mock_control/change/99']);
    });

    it.skip('should provide a default for `null` and clamp an out-of-range (but otherwise valid) timeout', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      let gotSpec = null;

      file._impl_transact = (spec) => {
        gotSpec = spec;
        throw new Error('to_be_expected');
      };

      async function test(v, expect) {
        await assert.isRejected(control.appendChange(change, v), /to_be_expected/);
        assert.instanceOf(gotSpec, TransactionSpec);

        const ops = gotSpec.opsWithName('timeout');
        assert.lengthOf(ops, 1);
        assert.strictEqual(ops[0].props.durMsec, expect);
      }

      await test(null,       Timeouts.MAX_TIMEOUT_MSEC);

      await test(0,          Timeouts.MIN_TIMEOUT_MSEC);
      await test(9999999999, Timeouts.MAX_TIMEOUT_MSEC);

      await test(Timeouts.MAX_TIMEOUT_MSEC, Timeouts.MAX_TIMEOUT_MSEC);

      await test(Timeouts.MIN_TIMEOUT_MSEC + 1, Timeouts.MIN_TIMEOUT_MSEC + 1);
      await test(Timeouts.MAX_TIMEOUT_MSEC - 1, Timeouts.MAX_TIMEOUT_MSEC - 1);

      for (let i = Timeouts.MIN_TIMEOUT_MSEC; i < Timeouts.MAX_TIMEOUT_MSEC; i += 987) {
        await test(i, i);
      }
    });

    it.skip('should call the snapshot maybe-writer and return `true` if the transaction succeeds', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      file._impl_transact = (spec_unused) => {
        return { paths: null, data: null, revNum: 99, newRevNum: 100 };
      };

      let maybeCalled = false;
      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        maybeCalled = true;
      };

      await assert.eventually.strictEqual(control.appendChange(change), true);
      assert.isTrue(maybeCalled);
    });

    it.skip('should return `false` if the transaction fails due to a precondition failure', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        throw new Error('Should not have been called');
      };

      async function test(error) {
        file._impl_transact = (spec_unused) => {
          throw error;
        };

        await assert.eventually.strictEqual(control.appendChange(change), false);
      }

      await test(fileStoreOt_Errors.pathHashMismatch('/whatever', FrozenBuffer.coerce('x').hash));
      await test(fileStoreOt_Errors.pathNotAbsent('/mock_control/change/99'));
    });

    it.skip('should rethrow any transaction error other than a precondition failure', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        throw new Error('Should not have been called');
      };

      async function test(error) {
        file._impl_transact = (spec_unused) => {
          throw error;
        };

        await assert.isRejected(control.appendChange(change), error);
      }

      await test(Errors.fileNotFound('x'));
      await test(Errors.timedOut(123456));
      await test(Errors.badValue('foo', 'bar'));
    });

    it('should reject an empty change', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(101, []);

      await assert.isRejected(control.appendChange(change), /badValue/);
    });

    it('should reject a change of the wrong type', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');

      await assert.isRejected(control.appendChange('not_a_change'), /badValue/);
    });

    it('should reject an invalid timeout value', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['florp', 'f'], ['blort', 'b']]);

      async function test(v) {
        await assert.isRejected(control.appendChange(change, v), /badValue/);
      }

      await test(-1);  // Must be a non-negative value.
      await test(0.5); // Must be an integer.
      await test('');
      await test('florp');
      await test(['florp']);
      await test({ florp: 12 });
    });
  });

  describe('currentRevNum()', () => {
    it.skip('should perform an appropriate transaction, and use the result', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');

      let gotSpec = null;

      file._impl_transact = (spec) => {
        gotSpec = spec;
        throw new Error('to_be_expected');
      };

      await assert.isRejected(control.currentRevNum(), /to_be_expected/);

      assert.instanceOf(gotSpec, TransactionSpec);
      assert.strictEqual(gotSpec.ops.length, 2);

      const ops1 = gotSpec.opsWithName('checkPathPresent');
      assert.lengthOf(ops1, 1);
      assert.strictEqual(ops1[0].props.storagePath, '/mock_control/revision_number');

      const ops2 = gotSpec.opsWithName('readPath');
      assert.lengthOf(ops2, 1);
      assert.strictEqual(ops2[0].props.storagePath, '/mock_control/revision_number');
    });

    it.skip('should use the result of the transaction it performed', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, file);
      const control    = new MockControl(fileAccess, 'boop');

      file._impl_transact = (spec_unused) => {
        return {
          revNum:    90909,
          newRevNum: null,
          paths:     null,
          data: new Map(Object.entries({
            '/mock_control/revision_number': CODEC.encodeJsonBuffer(1234)
          }))
        };
      };

      await assert.eventually.strictEqual(control.currentRevNum(), 1234);
    });

    it.skip('should reject improper transaction results', async () => {
      async function test(value) {
        const file       = new MockFile('blort');
        const fileAccess = new FileAccess(CODEC, file);
        const control    = new MockControl(fileAccess, 'boop');

        file._impl_transact = (spec_unused) => {
          return {
            revNum:    90909,
            newRevNum: null,
            paths:     null,
            data: new Map(Object.entries({
              '/mock_control/revision_number': CODEC.encodeJsonBuffer(value)
            }))
          };
        };

        await assert.isRejected(control.currentRevNum(), /^badValue/);
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
      const control    = new MockControl(FILE_ACCESS, 'boop');
      let gotStart     = null;
      let gotEnd       = null;
      let gotAllow     = null;
      let changeResult = 'filled in in tests';

      control._getChangeRange = async (start, end, allowMissing) => {
        gotStart = start;
        gotEnd   = end;
        gotAllow = allowMissing;
        return changeResult;
      };

      it('should pass appropriate arguments to `_getChangeRange()`', async () => {
        async function test(n) {
          await control.getChange(n);
          assert.strictEqual(gotStart, n);
          assert.strictEqual(gotEnd,   n + 1);
          assert.isTrue(gotAllow);
        }

        await test(0);
        await test(1);
        await test(914);
      });

      it('should return the first element of the return value from `_getChangeRange()`', async () => {
        changeResult = ['foomp'];
        const result = await control.getChange(123);
        assert.strictEqual(result, 'foomp');
      });

      it('should convert an empty result from `_getChangeRange()` a `revisionNotAvailable` error', async () => {
        changeResult = [];
        await assert.isRejected(control.getChange(1), /^revisionNotAvailable/);
      });
    });

    it('should promptly reject blatantly invalid `revNum` values', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control._getChangeRange = async (start_unused, end_unused, allow_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.getChange(value), /^badValue/);
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
      control.whenRevNum = async (revNum_unused, timeoutMsec_unused) => {
        throw new Error('This should not have been called.');
      };
      control.getDiff = async (base_unused, newer_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getChangeAfter(0), /^Oy!/);
    });

    it('should check the validity of `baseRevNum` against the response from `currentRevNum()`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control.whenRevNum = async (revNum_unused, timeoutMsec_unused) => {
        throw new Error('This should not have been called.');
      };
      control.getDiff = async (base_unused, newer_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getChangeAfter(11), /^badValue/);
    });

    it('should reject blatantly invalid `baseRevNum` values', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control.whenRevNum = async (revNum_unused, timeoutMsec_unused) => {
        throw new Error('This should not have been called.');
      };
      control.getDiff = async (base_unused, newer_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.getChangeAfter(value), /^badValue/);
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
      control.whenRevNum = async (revNum_unused, timeoutMsec) => {
        gotTimeout = timeoutMsec;
        throw new Error('boop');
      };
      control.getDiff = async (base_unused, newer_unused) => {
        throw new Error('This should not have been called.');
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

    it('should not call through to `whenRevNum()` if the requested revision is not the current one', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control.whenRevNum = async (revNum_unused, timeoutMsec_unused) => {
        throw new Error('This should not have been called.');
      };
      control.getDiff = async (base, newer) => {
        return `diff ${base} ${newer}`;
      };

      const result = await control.getChangeAfter(5);
      assert.strictEqual(result, 'diff 5 10');
    });

    it('should call through to `whenRevNum()` if the requested revision is the current one', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let   rev     = 10;
      control.currentRevNum = async () => {
        return rev;
      };
      control.whenRevNum = async (revNum, timeoutMsec_unused) => {
        if (revNum > rev) {
          rev = revNum;
        }
        return revNum;
      };
      control.getDiff = async (base, newer) => {
        return `diff ${base} ${newer}`;
      };

      const result = await control.getChangeAfter(10);
      assert.strictEqual(result, 'diff 10 11');
    });
  });

  describe('getDiff()', () => {
    it('should reject bad arguments', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');

      async function test(base, newer) {
        await assert.isRejected(control.getDiff(base, newer), /^badValue/);
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

      await assert.isRejected(control.getSnapshot(11), /^badValue/);
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
        await assert.isRejected(control.getSnapshot(value), /^badValue/);
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

    it('should convert a `null` subclass response to a `revisionNotAvailable` error', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        return null;
      };

      await assert.isRejected(control.getSnapshot(1), /^revisionNotAvailable/);
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

        await assert.isRejected(control.getSnapshot(1), /^badValue/);
      }

      await test(-1);
      await test(0.05);
      await test('blort');
      await test([10]);
    });
  });

  describe('update()', () => {
    it('should reject non-change first arguments', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('This should not have been called.');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };
      control._impl_rebase = async (change_unused, base_unused, expected_unused, current_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.update(value), /^badValue/);
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
      control._impl_rebase = async (change_unused, base_unused, expected_unused, current_unused) => {
        throw new Error('This should not have been called.');
      };

      async function test(value) {
        await assert.isRejected(control.update(value), /^badValue/);
      }

      // `0` is not a valid `revNum` for this method.
      await test(new MockChange(0, [], Timestamp.MIN_VALUE));

      // `timestamp` must be present for this method.
      await test(new MockChange(1, []));
    });

    it('should reject an invalid timeout value', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        throw new Error('This should not have been called.');
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };
      control._impl_rebase = async (change_unused, base_unused, expected_unused, current_unused) => {
        throw new Error('This should not have been called.');
      };

      const change = new MockChange(11, [], Timestamp.MIN_VALUE);

      async function test(value) {
        await assert.isRejected(control.update(change, value), /^badValue/);
      }

      await test(-1);  // Must be a non-negative value.
      await test(0.5); // Must be an integer.
      await test('');
      await test('florp');
      await test(['florp']);
      await test({ florp: 12 });
    });

    it('should reject a too-large `revNum` in valid nontrivial cases', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._impl_rebase = async (change_unused, base_unused, expected_unused, current_unused) => {
        throw new Error('This should not have been called.');
      };

      const change = new MockChange(12, [new MockOp('abc')], Timestamp.MIN_VALUE);
      await assert.isRejected(control.update(change), /^badValue/);
    });

    it('should call through to `_attemptUpdate()` given an empty change', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._attemptUpdate =
        async (change_unused, baseSnapshot_unused, expectedSnapshot_unused, timeoutMsec_unused) => {
          throw new Error('expected');
        };

      const change = new MockChange(1,  [], Timestamp.MIN_VALUE);
      await assert.isRejected(control.update(change), /expected/);
    });

    it('should call through to `_attemptUpdate()` in valid nontrivial cases', async () => {
      const control   = new MockControl(FILE_ACCESS, 'boop');
      const current   = new MockSnapshot(10, [new MockOp('x', 10)]);
      let callCount   = 0;
      let gotChange   = 'x';
      let gotBase     = 'x';
      let gotExpected = 'x';
      let gotTimeout  = 'x';

      control.currentRevNum = async () => {
        return current.revNum;
      };
      control._impl_getSnapshot = async (revNum) => {
        return (revNum === current.revNum)
          ? current
          : new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._attemptUpdate = async (change, baseSnapshot, expectedSnapshot, timeoutMsec) => {
        callCount++;
        gotChange   = change;
        gotBase     = baseSnapshot;
        gotExpected = expectedSnapshot;
        gotTimeout  = timeoutMsec;
        return new MockChange(14, [new MockOp('q')]);
      };

      const change = new MockChange(7, [new MockOp('abc')], Timestamp.MIN_VALUE);
      const result = await control.update(change);

      assert.strictEqual(callCount, 1);
      assert.deepEqual(gotBase, new MockSnapshot(6, [new MockOp('x', 6)]));
      assert.strictEqual(gotChange, change);
      assert.deepEqual(gotExpected,
        new MockSnapshot(7, [new MockOp('composed_doc'), new MockOp('abc')]));
      assert.isNumber(gotTimeout);

      assert.instanceOf(result, MockChange);
      assert.deepEqual(result, new MockChange(14, [new MockOp('q')]));
    });

    it('should retry the `_attemptUpdate()` call if it returns `null`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let callCount = 0;

      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum) => {
        return new MockSnapshot(revNum, [new MockOp('x', revNum)]);
      };
      control._attemptUpdate =
        async (change_unused, baseSnapshot_unused, expectedSnapshot_unused, timeoutMsec_unused) => {
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
      const fileAccess = new FileAccess(CODEC, file);
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
      const fileAccess = new FileAccess(CODEC, file);
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
