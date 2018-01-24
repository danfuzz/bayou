// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { FileOp, FileSnapshot, PredicateOp } from 'file-store-ot';
import { FrozenBuffer, InfoError } from 'util-common';

/**
 * Defines a suite for a specific op.
 *
 * @param {string} name Name of the operation.
 * @param {array<array<*>>} badArgses Array of arguments arrays, all of which
 *   should result in a construction error.
 * @param {array<[FileSnapshot,array<*>]>} trueCases Array of pairs of snapshot
 *   and contructor args, for which `test()` should return `true`.
 * @param {array<[FileSnapshot,array<*>]>} falseCases Array of pairs of snapshot
 *   and contructor args, for which `test()` should return `false`.
 * @param {string} errorName Name of the error that gets thrown when a failure
 *   is reported by `throwIfNotSatisfied()`.
 */
function opSuite(name, badArgses, trueCases, falseCases, errorName) {
  const constructorName = `op_${name}`;

  describe(`\`${name}\` operation`, () => {
    describe(`${constructorName}()`, () => {
      for (const [snap_unused, args] of [...trueCases, ...falseCases]) {
        it(`should accept valid arguments: ${inspect(args)}`, () => {
          const result  = PredicateOp[constructorName](...args);
          const payload = result.payload;

          assert.strictEqual(payload.name, name);
          assert.strictEqual(payload.args.length, args.length);

          // **Note:** We can't test the arguments for equality because the
          // constructors can process them (notably, converting buffers to
          // hashes).
        });
      }

      for (const args of badArgses) {
        it(`should reject invalid arguments: ${inspect(args)}`, () => {
          assert.throws(() => PredicateOp[constructorName](...args), /badValue/);
        });
      }
    });

    describe('test()', () => {
      describe('`true` cases', () => {
        let i = 1;

        for (const [snap, args] of trueCases) {
          describe(`#${i}: ${inspect(args)}`, () => {
            it('should return `true` given a snapshot that satisfies the operation', () => {
              const op = PredicateOp[constructorName](...args);
              assert.isTrue(op.test(snap));
            });
          });

          i++;
        }
      });

      describe('`false` cases', () => {
        let i = 1;

        for (const [snap, args] of falseCases) {
          describe(`#${i}: ${inspect(args)}`, () => {
            it('should return `false` given a snapshot that does not satisfy the operation', () => {
              const op = PredicateOp[constructorName](...args);
              assert.isFalse(op.test(snap));
            });
          });

          i++;
        }
      });
    });

    describe('throwIfNotSatisfied()', () => {
      describe('pass cases', () => {
        let i = 1;

        for (const [snap, args] of trueCases) {
          describe(`#${i}: ${inspect(args)}`, () => {
            it('should return without error given a snapshot that satisfies the operation', () => {
              const op = PredicateOp[constructorName](...args);
              assert.doesNotThrow(() => { op.throwIfNotSatisfied(snap); });
            });
          });

          i++;
        }
      });

      describe('throw cases', () => {
        let i = 1;

        for (const [snap, args] of falseCases) {
          describe(`#${i}: ${inspect(args)}`, () => {
            it('should throw an error given a snapshot that does not satisfy the operation', () => {
              const op = PredicateOp[constructorName](...args);

              // Not just `assert.throws()` so we can confirm the error details.
              try {
                op.throwIfNotSatisfied(snap);
                assert.fail('Expected to throw.');
              } catch (e) {
                assert.instanceOf(e, InfoError);
                assert.strictEqual(e.info.name, errorName);
                assert.deepEqual(e.info.args, op.payload.args);
              }
            });
          });

          i++;
        }
      });
    });
  });
}

describe('file-store-ot/PredicateOp', () => {
  const buf1 = new FrozenBuffer('blort');
  const buf2 = new FrozenBuffer('florp');
  const buf3 = new FrozenBuffer('zorch');
  const buf4 = new FrozenBuffer('splat');

  const snap1 = FileSnapshot.EMPTY;
  const snap2 = new FileSnapshot(123, [
    FileOp.op_writeBlob(buf1),
    FileOp.op_writeBlob(buf2),
    FileOp.op_writePath('/x', buf3),
    FileOp.op_writePath('/y', buf4),
    FileOp.op_writePath('/z/123', buf4),
  ]);

  opSuite('blobAbsent',
    // Invalid constructor args.
    [
      [null],
      [undefined],
      [{ x: 10 }],
      ['florp'] // Invalid hash string.
    ],

    // Where `test()` returns `true`.
    [
      [snap1, [buf1]],
      [snap1, [buf1.hash]],
      [snap2, [buf3]],
      [snap2, [buf4.hash]]
    ],

    // Where `test()` returns `false`.
    [
      [snap2, [buf1]],
      [snap2, [buf1.hash]]
    ],

    'blobNotAbsent' // Thrown error name.
  );

  opSuite('blobPresent',
    // Invalid constructor args.
    [
      [null],
      [undefined],
      [{ x: 10 }],
      ['florp'] // Invalid hash string.
    ],

    // Where `test()` returns `true`.
    [
      [snap2, [buf1]],
      [snap2, [buf1.hash]],
      [snap2, [buf2]],
      [snap2, [buf2.hash]]
    ],

    // Where `test()` returns `false`.
    [
      [snap1, [buf1]],
      [snap1, [buf1.hash]],
      [snap2, [buf3]],
      [snap1, [buf4.hash]]
    ],

    'blobNotFound' // Thrown error name.
  );

  opSuite('pathAbsent',
    // Invalid constructor args.
    [
      [null],
      [undefined],
      [{ x: 10 }],
      ['//foo'], // Invalid storage path.
      ['boop']   // Likewise.
    ],

    // Where `test()` returns `true`.
    [
      [snap1, ['/boop']],
      [snap2, ['/x/y']],
      [snap2, ['/z']]
    ],

    // Where `test()` returns `false`.
    [
      [snap2, ['/x']],
      [snap2, ['/z/123']]
    ],

    'pathNotAbsent' // Thrown error name.
  );

  opSuite('pathIs',
    // Invalid constructor args.
    [
      [null,      null],
      [undefined, undefined],
      [123,       123],
      ['xyz',     'xyz'],     // Invalid path and hash (in that order).
      ['xyz',     buf1],      // First argument invalid.
      ['xyz',     buf1.hash], // First argument invalid.
      ['/foo',    'xyz']      // Second argument invalid.
    ],

    // Where `test()` returns `true`.
    [
      [snap2, ['/x', buf3]],
      [snap2, ['/x', buf3.hash]]
    ],

    // Where `test()` returns `false`.
    [
      [snap1, ['/florp', buf1]],
      [snap1, ['/florp', buf1.hash]],
      [snap2, ['/x',     buf2]],
      [snap2, ['/x',     buf2.hash]]
    ],

    'pathHashMismatch' // Thrown error name.
  );

  opSuite('pathIsNot',
    // Invalid constructor args.
    [
      [null,      null],
      [undefined, undefined],
      [123,       123],
      ['xyz',     'xyz'],     // Invalid path and hash (in that order).
      ['xyz',     buf1],      // First argument invalid.
      ['xyz',     buf1.hash], // First argument invalid.
      ['/foo',    'xyz']      // Second argument invalid.
    ],

    // Where `test()` returns `true`.
    [
      [snap1, ['/florp', buf1]],
      [snap1, ['/florp', buf1.hash]],
      [snap2, ['/x',     buf2]],
      [snap2, ['/x',     buf2.hash]]
    ],

    // Where `test()` returns `false`.
    [
      [snap2, ['/x', buf3]],
      [snap2, ['/x', buf3.hash]]
    ],

    'pathHashMismatch' // Thrown error name.
  );

  opSuite('pathPresent',
    // Invalid constructor args.
    [
      [null],
      [undefined],
      [{ x: 10 }],
      ['//foo'], // Invalid storage path.
      ['boop']   // Likewise.
    ],

    // Where `test()` returns `true`.
    [
      [snap2, ['/x']],
      [snap2, ['/z/123']]
    ],

    // Where `test()` returns `false`.
    [
      [snap1, ['/boop']],
      [snap2, ['/x/y']],
      [snap2, ['/z']]
    ],

    'pathNotFound' // Thrown error name.
  );

  opSuite('revNumIs',
    // Invalid constructor args.
    [
      [null],
      [undefined],
      [{ x: 10 }],
      ['blort'],
      [-1],        // Can't be negative.
      [0.123],     // Can't be fractional.
      [NaN],       // Must be finite.
      [Infinity]  // Must be finite.
    ],

    // Where `test()` returns `true`.
    [
      [snap1, [0]],
      [snap2, [123]]
    ],

    // Where `test()` returns `false`.
    [
      [snap1, [1]],
      [snap2, [0]]
    ],

    'revNumMismatch' // Thrown error name.
  );
});
