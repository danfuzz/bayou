// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { describe } from 'mocha';
import { inspect } from 'util';

import { TransactionOp } from 'file-store-ot';
import { Errors, FrozenBuffer, UtilityClass } from 'util-common';

/**
 * Test helper utility class for constructing valid arrays of ops which cover
 * all op types.
 */
export default class FileOpMaker extends UtilityClass {
  /**
   * Makes a valid ops array of the given length. All ops in the result are of
   * the same type.
   *
   * @param {Int} length Desired length.
   * @returns {array<TransactionOp>} Appropriately-constructed array of ops.
   */
  static makeLength(length) {
    const ops = [];

    for (let i = 0; i < length; i++) {
      ops.push(TransactionOp.op_checkPathPresent(`/blort/${i}`));
    }

    return ops;
  }

  /**
   * Makes an op with the given name. The second argument is to allow for
   * different values, without introducing nondeterminism.
   *
   * @param {string} name Op name, as defined by {@link TransactionOp}.
   * @param {Int} n Non-negative integer, to provide something to derive a
   *   unique value from.
   * @returns {TransactionOp} Appropriate op.
   */
  static makeOp(name, n) {
    const schema = TransactionOp.propsFromName(name);
    const args   = [];

    for (const [name_unused, type] of schema.args) {
      args.push(FileOpMaker._makeValue(type, n));
    }

    return TransactionOp[`op_${name}`](...args);
  }

  /**
   * Makes a valid array with one of each op name _except_ wait ops, and at
   * least the given number each of ops of type `push` and `pull`.
   *
   * @param {Int} count How many of each `push` and `pull` op to include.
   * @returns {array<TransactionOp>} Appropriately-constructed array of ops.
   */
  static makePushPull(count) {
    const ops = [];

    for (const name of TransactionOp.OPERATION_NAMES) {
      const schema = TransactionOp.propsFromName(name);
      if (schema.category === TransactionOp.CAT_wait) {
        continue;
      }

      const n = (schema.isPush || schema.isPull) ? count : 1;
      for (let i = 0; i < n; i++) {
        ops.push(FileOpMaker.makeOp(name, i));
      }
    }

    return ops;
  }

  /**
   * Makes a valid array with one of each op name _except_ push and pull ops,
   * and at least the given number each of ops of type `wait`.
   *
   * @param {Int} count How many of each `wait` op to include.
   * @returns {array<TransactionOp>} Appropriately-constructed array of ops.
   */
  static makeWait(count) {
    const ops = [];

    for (const name of TransactionOp.OPERATION_NAMES) {
      const schema = TransactionOp.propsFromName(name);
      if (schema.isPush || schema.isPull) {
        continue;
      }

      const n = (schema.category === TransactionOp.CAT_wait) ? count : 1;
      for (let i = 0; i < n; i++) {
        ops.push(FileOpMaker.makeOp(name, i));
      }
    }

    return ops;
  }

  /**
   * Performs a series of `describe()` test cases with various valid arrays of
   * ops passed to an inner test function.
   *
   * @param {function} testFunction Test function to call. It is passed a valid
   *   array of ops as a single argument.
   */
  static testCases(testFunction) {
    function test(value, label = null) {
      if (label === null) {
        label = inspect(value);
      }

      describe(`for ops: ${label}`, () => {
        value = Object.freeze(value);
        testFunction(value);
      });
    }

    test([]);
    test(FileOpMaker.makeLength(1));
    test(FileOpMaker.makeLength(2));
    test(FileOpMaker.makeLength(10));
    test(FileOpMaker.makeLength(50),  '(length 50)');
    test(FileOpMaker.makeLength(123), '(length 123)');
    test(FileOpMaker.makePushPull(1));
    test(FileOpMaker.makePushPull(2), '(push-pull 2)');
    test(FileOpMaker.makePushPull(5), '(push-pull 5)');
    test(FileOpMaker.makeWait(1));
    test(FileOpMaker.makeWait(2), '(wait 2)');
    test(FileOpMaker.makeWait(5), '(wait 5)');
  }

  /**
   * Makes a value of the given type. The second argument is to allow for
   * different values, without introducing nondeterminism.
   *
   * @param {string} type Value type, as defined by {@link TransactionOp}.
   * @param {Int} n Non-negative integer, to provide something to derive a
   *   unique value from.
   * @returns {*} Appropriate value.
   */
  static _makeValue(type, n) {
    switch (type) {
      case TransactionOp.TYPE_Buffer: {
        return FrozenBuffer.coerce(`buffer_${n}`);
      }
      case TransactionOp.TYPE_DurMsec: {
        return n * 1234;
      }
      case TransactionOp.TYPE_Hash: {
        const buf = FrozenBuffer.coerce(`buffer_hash_${n}`);
        return buf.hash;
      }
      case TransactionOp.TYPE_Index: {
        return n + 100;
      }
      case TransactionOp.TYPE_Path: {
        return `/path/${n}`;
      }
      case TransactionOp.TYPE_RevNum: {
        return n;
      }
      default: {
        // Indicates a bug in this class.
        throw Errors.wtf(`Weird \`type\` constant: ${type}`);
      }
    }
  }
}