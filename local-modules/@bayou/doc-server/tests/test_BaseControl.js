// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codecs as appCommon_Codecs } from '@bayou/app-common';
import { Timeouts } from '@bayou/doc-common';
import { MockChange, MockDelta, MockOp, MockSnapshot } from '@bayou/ot-common/mocks';
import { BaseControl, DurableControl, FileAccess } from '@bayou/doc-server';
import { MockControl } from '@bayou/doc-server/mocks';
import { MockFile } from '@bayou/file-store/mocks';
import { Errors as fileStoreOt_Errors, FileChange, FileSnapshot, FileOp } from '@bayou/file-store-ot';
import { Timestamp } from '@bayou/ot-common';
import { Codecs as mocks_Codecs } from '@bayou/ot-common/mocks';
import { Errors, FrozenBuffer } from '@bayou/util-common';

// **Note:** Even though these tests are written in terms of `DurableControl`
// and a subclass thereof, they are limited to testing behavior which is common
// to all control classes. This is why it is labeled as being for `BaseControl`.
describe('@bayou/doc-server/BaseControl', () => {
  /** {Codec} Convenient instance of `Codec`. */
  const CODEC = appCommon_Codecs.makeModelCodec();
  mocks_Codecs.registerCodecs(CODEC.registry);

  /** {FileAccess} Convenient instance of `FileAccess`. */
  const FILE_ACCESS = new FileAccess(CODEC, 'doc-xyz', new MockFile('blort'));

  describe('.changeClass', () => {
    it('reflects the subclass\'s implementation', () => {
      const result = MockControl.changeClass;
      assert.strictEqual(result, MockSnapshot.changeClass);
    });
  });

  describe('.changePathPrefix', () => {
    it('reflects the subclass\'s implementation', () => {
      const result = MockControl.changePathPrefix;
      assert.strictEqual(result, '/mock_control/change');
    });
  });

  describe('.deltaClass', () => {
    it('reflects the subclass\'s implementation', () => {
      const result = MockControl.deltaClass;
      assert.strictEqual(result, MockSnapshot.deltaClass);
    });
  });

  describe('.pathPrefix', () => {
    it('reflects the subclass\'s implementation', () => {
      const result = MockControl.pathPrefix;
      assert.strictEqual(result, '/mock_control');
    });

    it('rejects an improper subclass choice', () => {
      class HasBadPrefix extends DurableControl {
        static get _impl_pathPrefix() {
          return '//invalid/path_string!';
        }
      }

      assert.throws(() => HasBadPrefix.pathPrefix);
    });

    it('only ever asks the subclass once', () => {
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
    it('reflects the subclass\'s implementation', () => {
      const result = MockControl.snapshotClass;
      assert.strictEqual(result, MockSnapshot);
    });

    it('rejects an improper subclass choice', () => {
      class HasBadSnapshot extends DurableControl {
        static get _impl_snapshotClass() {
          return Object;
        }
      }

      assert.throws(() => HasBadSnapshot.snapshotClass);
    });

    it('only ever asks the subclass once', () => {
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
    it('returns an appropriate path given a valid argument', () => {
      function test(value) {
        const expect = `${MockControl.pathPrefix}/change/${value}`;
        assert.strictEqual(MockControl.pathForChange(value), expect);
      }

      test(0);
      test(1);
      test(10);
      test(100000914);
    });

    it('rejects invalid arguments', () => {
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
    it('accepts a `FileAccess` and reflects it in the inherited getters', () => {
      const fa     = FILE_ACCESS;
      const result = new MockControl(fa, 'boop');

      assert.strictEqual(result.codec,      fa.codec);
      assert.strictEqual(result.file,       fa.file);
      assert.strictEqual(result.fileAccess, fa);
      assert.strictEqual(result.fileCodec,  fa.fileCodec);

      // `log` will be different, because it adds the `logLabel` as a prefix.
      assert.notStrictEqual(result.log, fa.log);
    });

    it('rejects non-`FileAccess` arguments', () => {
      assert.throws(() => new MockControl(null,      'boop'));
      assert.throws(() => new MockControl({ x: 10 }, 'boop'));
    });
  });

  describe('appendChange()', () => {
    it('performs an appropriate operation given a valid change', async () => {
      const file = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control = new MockControl(fileAccess, 'boop');
      const expectedMockChangeRevNum = 99;
      const change = new MockChange(expectedMockChangeRevNum, [['x', 'f'], ['y', 'b']]);
      const snapshotRevNum = 100;
      const expectedFileChangeRevNum = snapshotRevNum + 1;

      let actualFileChange;

      // TODO: Replace with stub
      file.getSnapshot = () => new MockSnapshot(snapshotRevNum, [['yes']]);

      // TODO: Replace with stub
      file.appendChange = (changeToAppend) => {
        actualFileChange = changeToAppend;
        throw new Error('to_be_expected');
      };

      // TODO: Replace with stub
      await assert.isRejected(control.appendChange(change, 1234), /to_be_expected/);

      assert.instanceOf(actualFileChange, FileChange);
      assert.strictEqual(actualFileChange.revNum, expectedFileChangeRevNum);

      const changeWritePathOp = actualFileChange.delta.ops[0];
      assert.strictEqual(changeWritePathOp.props.opName, 'writePath');
      assert.strictEqual(changeWritePathOp.props.path, `/mock_control/change/${expectedMockChangeRevNum}`);

      const revNumWritePathOp = actualFileChange.delta.ops[1];
      assert.strictEqual(revNumWritePathOp.props.opName, 'writePath');
      assert.strictEqual(revNumWritePathOp.props.path, `/mock_control/revision_number`);
    });

    it('provides a default for `null` and clamps an out-of-range (but otherwise valid) timeout', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['x', 'f'], ['y', 'b']]);

      let actualFileChange;
      let actualTimeout;

      // TODO: Replace with stub
      file.appendChange = (changeToAppend, clampedTimeout) => {
        actualFileChange = changeToAppend;
        actualTimeout = clampedTimeout;
        throw new Error('to_be_expected');
      };

      // TODO: Replace with stub
      file.getSnapshot = () => new MockSnapshot(100, [['x', 1]]);

      async function test(timeout, expect, msg) {
        await assert.isRejected(control.appendChange(change, timeout), /to_be_expected/, `${msg} rejection check`);
        assert.instanceOf(actualFileChange, FileChange, `${msg}: instance check`);

        // This is a little squishy, because we're dealing with real wall time
        // here (that is, time is not mocked out): We accept any received
        // timeout value which is non-negative and no more than 10ms less than
        // the expected value.
        const expectMin = Math.max(0, expect - 10);
        const expectMax = expect;
        assert.isAtLeast(actualTimeout, expectMin, `${msg}: timeout minimum value check`);
        assert.isAtMost(actualTimeout, expectMax, `${msg}: timeout maximum value check`);
      }

      await test(null, Timeouts.MAX_TIMEOUT_MSEC, '#1');
      await test(0, Timeouts.MIN_TIMEOUT_MSEC, '#2');
      await test(9999999999, Timeouts.MAX_TIMEOUT_MSEC, '#3');
      await test(Timeouts.MAX_TIMEOUT_MSEC, Timeouts.MAX_TIMEOUT_MSEC, '#4');
      await test(Timeouts.MIN_TIMEOUT_MSEC + 1, Timeouts.MIN_TIMEOUT_MSEC + 1, '#5');
      await test(Timeouts.MAX_TIMEOUT_MSEC - 1, Timeouts.MAX_TIMEOUT_MSEC - 1, '#6');

      for (let i = Timeouts.MIN_TIMEOUT_MSEC; i < Timeouts.MAX_TIMEOUT_MSEC; i += 987) {
        await test(i, i, `loop at ${i}`);
      }
    });

    it('calls the snapshot maybe-writer and html exporter, and returns `true` if the operation succeeds', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['x', 'f'], ['y', 'b']]);

      file.getSnapshot = () => new MockSnapshot(100, [['yes']]);

      // TODO: Replace with spy
      let storeSnapshotCalled = false;
      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        storeSnapshotCalled = true;
      };

      await assert.eventually.strictEqual(control.appendChange(change), true);
      assert.isTrue(storeSnapshotCalled);
    });

    it('returns `false` if the operation fails due to a precondition failure', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['x', 'f'], ['y', 'b']]);

      file.getSnapshot = () => new MockSnapshot(100, [['yes']]);

      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        throw new Error('Should not have been called');
      };

      async function test(error) {
        file.appendChange = () => {
          throw error;
        };

        await assert.eventually.strictEqual(control.appendChange(change), false);
      }

      await test(fileStoreOt_Errors.pathHashMismatch('/whatever', FrozenBuffer.coerce('x').hash));
      await test(fileStoreOt_Errors.pathNotAbsent('/mock_control/change/99'));
    });

    it('rethrows any error other than a precondition failure and timeout', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['x', 'f'], ['y', 'b']]);

      file.getSnapshot = () => new MockSnapshot(100, [['x']]);

      control._maybeWriteStoredSnapshot = (revNum_unused) => {
        throw new Error('Should not have been called');
      };

      async function test(error) {
        file.appendChange = () => {
          throw error;
        };

        await assert.isRejected(control.appendChange(change), error);
      }

      await test(Errors.fileNotFound('x'));
      await test(Errors.badValue('foo', 'bar'));
    });

    it('rejects an empty change', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(101, []);

      await assert.isRejected(control.appendChange(change), /badValue/);
    });

    it('rejects a change of the wrong type', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');

      await assert.isRejected(control.appendChange('not_a_change'), /badValue/);
    });

    it('rejects an invalid timeout value', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
      const control    = new MockControl(fileAccess, 'boop');
      const change     = new MockChange(99, [['x', 'f'], ['y', 'b']]);

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
    it('uses the result of the operation it performed', async () => {
      const file           = new MockFile('blort');
      const fileAccess     = new FileAccess(CODEC, 'doc-1', file);
      const control        = new MockControl(fileAccess, 'boop');
      const expectedRevNum = 1234;

      const fileOp = FileOp.op_writePath('/mock_control/revision_number', CODEC.encodeJsonBuffer(expectedRevNum));

      file.getSnapshot = () => new FileSnapshot(90909, [fileOp]);

      await assert.eventually.strictEqual(control.currentRevNum(), expectedRevNum);
    });

    it('rejects improper subclass results', async () => {
      async function test(revNum) {
        const file       = new MockFile('blort');
        const fileAccess = new FileAccess(CODEC, 'doc-1', file);
        const control    = new MockControl(fileAccess, 'boop');

        // TODO: Replace with stub
        file.getSnapshot = () => new MockSnapshot(revNum, [[`snap_blort_${revNum}`]]);

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

      it('passes appropriate arguments to `_getChangeRange()`', async () => {
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

      it('returns the first element of the return value from `_getChangeRange()`', async () => {
        changeResult = ['foomp'];
        const result = await control.getChange(123);
        assert.strictEqual(result, 'foomp');
      });

      it('converts an empty result from `_getChangeRange()` a `revisionNotAvailable` error', async () => {
        changeResult = [];
        await assert.isRejected(control.getChange(1), /^revisionNotAvailable/);
      });
    });

    it('promptly rejects blatantly invalid `revNum` values', async () => {
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
    it('calls through to `currentRevNum()` before anything else', async () => {
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

    it('checks the validity of `baseRevNum` against the response from `currentRevNum()`', async () => {
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

    it('rejects blatantly invalid `baseRevNum` values', async () => {
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

    it('appropriately clamps `timeoutMsec` values', async () => {
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

    it('does not call through to `whenRevNum()` if the requested revision is not the current one', async () => {
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

    it('calls through to `whenRevNum()` if the requested revision is the current one', async () => {
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
    it('rejects bad arguments', async () => {
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

    it('produces a result in one of the two specified ways', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      let reqBase, reqNewer;

      control.getSnapshot = async (revNum) => {
        assert((revNum === reqBase) || (revNum === reqNewer), `Unexpected revNum: ${revNum}`);
        return new MockSnapshot(revNum, [['snap', revNum]]);
      };

      control.getComposedChanges = async (baseDelta, startInc, endExc, wantDocument) => {
        // Validate how we expect to be called.
        assert.strictEqual(baseDelta, MockDelta.EMPTY);
        assert.strictEqual(startInc, reqBase + 1);
        assert.strictEqual(endExc, reqNewer + 1);
        assert.isFalse(wantDocument);
        return new MockDelta([['yes', reqBase]]);
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

        const ops = result.delta.ops;

        if (ops[0].equals(new MockOp('yes', base))) {
          composedCount++;
        } else if (ops[0].name === 'diffDelta') {
          diffCount++;
          assert.lengthOf(ops, 2);
          assert.deepEqual(ops[1], new MockOp('snap', newer));
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
    it('calls through to `currentRevNum()` before anything else', async () => {
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

    it('checks the validity of a non-`null` `revNum` against the response from `currentRevNum()`', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        throw new Error('This should not have been called.');
      };

      await assert.isRejected(control.getSnapshot(11), /^badValue/);
    });

    it('rejects blatantly invalid `revNum` values', async () => {
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

    it('returns back a valid non-`null` subclass response', async () => {
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

    it('uses the returned `currentRevNum` when `revNum` is passed asa `null`', async () => {
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

    it('converts a `null` subclass response to a `revisionNotAvailable` error', async () => {
      const control = new MockControl(FILE_ACCESS, 'boop');
      control.currentRevNum = async () => {
        return 10;
      };
      control._impl_getSnapshot = async (revNum_unused) => {
        return null;
      };

      await assert.isRejected(control.getSnapshot(1), /^revisionNotAvailable/);
    });

    it('rejects a non-snapshot subclass response', async () => {
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
    it('rejects non-change first arguments', async () => {
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

    it('rejects change arguments with invalid fields', async () => {
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

    it('rejects an invalid timeout value', async () => {
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

    it('rejects a too-large `revNum` in valid nontrivial cases', async () => {
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

      const change = new MockChange(12, [new MockOp('y')], Timestamp.MIN_VALUE);
      await assert.isRejected(control.update(change), /^badValue/);
    });

    it('calls through to `_attemptUpdate()` given an empty change', async () => {
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

    it('calls through to `_attemptUpdate()` in valid nontrivial cases', async () => {
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
        return new MockChange(14, [new MockOp('yes')]);
      };

      const change = new MockChange(7, [new MockOp('y')], Timestamp.MIN_VALUE);
      const result = await control.update(change);

      assert.strictEqual(callCount, 1);
      assert.deepEqual(gotBase, new MockSnapshot(6, [new MockOp('x', 6)]));
      assert.strictEqual(gotChange, change);
      assert.deepEqual(gotExpected,
        new MockSnapshot(7, [new MockOp('composedDoc', 1), new MockOp('y')]));
      assert.isNumber(gotTimeout);

      assert.instanceOf(result, MockChange);
      assert.deepEqual(result, new MockChange(14, [new MockOp('yes')]));
    });

    it('retries the `_attemptUpdate()` call if it returns `null`', async () => {
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
          return new MockChange(14, [new MockOp('yes')]);
        };

      const change = new MockChange(7, [new MockOp('x')], Timestamp.MIN_VALUE);
      const result = await control.update(change);

      assert.strictEqual(callCount, 2);
      assert.deepEqual(result, new MockChange(14, [new MockOp('yes')]));
    });
  });

  describe('whenRevNum()', () => {
    it('returns promptly if the revision is already available', async () => {
      const file       = new MockFile('blort');
      const fileAccess = new FileAccess(CODEC, 'doc-1', file);
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

    // **TODO:** Need a test that demonstrates this method waiting until the
    // revision is written.
  });

  describe('_missingChangeError()', () => {
    // Makes the call to the method, expecting an error. Returns the error
    // message (or fails the assertion).
    function messageFromCall(...args) {
      const result = BaseControl._missingChangeError(...args);
      assert.instanceOf(result, Error);
      return result.message;
    }

    // Common cases for all numbers of missing changes.
    function commonCases(missingChanges) {
      it('includes the document ID', () => {
        function test(docId) {
          const result = messageFromCall(docId, 10, 20, missingChanges);
          assert.isTrue(result.indexOf(docId) !== -1);
        }

        test('florp');
        test('bip-bop-boop');
      });

      it('includes the inclusive request range', () => {
        function test(startInc, endExc) {
          const result = messageFromCall('x', startInc, endExc, missingChanges);
          const expect = `r${startInc}..r${endExc - 1}`;
          assert.isTrue(result.indexOf(expect) !== -1);
        }

        test(0, 5);
        test(1, 123);
      });
    }

    describe('missing one change', () => {
      const missingChanges = [914];

      commonCases(missingChanges);

      it('includes the missing change', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': r914') !== -1);
      });
    });

    describe('missing two changes', () => {
      const missingChanges = [12, 34];

      commonCases(missingChanges);

      it('includes the missing changes', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': [r12, r34]') !== -1);
      });
    });

    describe('missing three changes', () => {
      const missingChanges = [23, 187, 242];

      commonCases(missingChanges);

      it('includes the missing changes', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': [r23, r187, r242]') !== -1);
      });
    });

    describe('missing four changes', () => {
      const missingChanges = [7, 9, 10, 11];

      commonCases(missingChanges);

      it('includes the missing changes', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': [r7, r9, r10, r11]') !== -1);
      });
    });

    describe('missing five changes', () => {
      const missingChanges = [123, 456, 789, 1011, 1213];

      commonCases(missingChanges);

      it('includes a summary of the missing changes', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': [r123, ... 3 more ..., r1213]') !== -1);
      });
    });

    describe('missing fifty changes', () => {
      const missingChanges = [];

      for (let i = 0; i < 50; i++) {
        missingChanges.push(i + 1000);
      }

      commonCases(missingChanges);

      it('includes a summary of the missing changes', () => {
        const result = messageFromCall('x', 1, 2, missingChanges);
        assert.isTrue(result.indexOf(': [r1000, ... 48 more ..., r1049]') !== -1);
      });
    });
  });
});
