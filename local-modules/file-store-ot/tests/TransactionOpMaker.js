// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { describe } from 'mocha';
import { inspect } from 'util';

import { TransactionOp } from 'file-store-ot';
import { Errors, FrozenBuffer, UtilityClass } from '@bayou/util-common';

/**
 * Test helper utility class for constructing valid arrays of ops which cover
 * all op types.
 */
export default class TransactionOpMaker extends UtilityClass {
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
      args.push(TransactionOpMaker._makeValue(type, n));
    }

    return TransactionOp[`op_${name}`](...args);
  }

  /**
   * Makes a valid array with one of each op name that isn't a wait, push, or
   * pull; and the given number of _each_ of the ops of the indicated category.
   *
   * @param {string} category Category in question. Must be one of `wait`,
   *   `push`, or `pull`.
   * @param {Int} count How many ops of each indicated category to include.
   * @returns {array<TransactionOp>} Appropriately-constructed array of ops.
   */
  static makeWithCategory(category, count) {
    const ops = [];

    function schemaCategory(schema) {
      if      (schema.isPush)                              { return 'push';  }
      else if (schema.isPull)                              { return 'pull';  }
      else if (schema.category === TransactionOp.CAT_wait) { return 'wait';  }
      else                                                 { return 'other'; }
    }

    for (const name of TransactionOp.OPERATION_NAMES) {
      const schema = TransactionOp.propsFromName(name);
      const cat    = schemaCategory(schema);

      let n;
      if      (cat === category) { n = count; }
      else if (cat === 'other')  { n = 1;     }
      else                       { n = 0;     }

      for (let i = 0; i < n; i++) {
        ops.push(TransactionOpMaker.makeOp(name, i));
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
    test(TransactionOpMaker.makeLength(1));
    test(TransactionOpMaker.makeLength(2));
    test(TransactionOpMaker.makeLength(10));
    test(TransactionOpMaker.makeLength(50),  '(length 50)');
    test(TransactionOpMaker.makeLength(123), '(length 123)');
    test(TransactionOpMaker.makeWithCategory('push', 1));
    test(TransactionOpMaker.makeWithCategory('push', 2), '(push 2)');
    test(TransactionOpMaker.makeWithCategory('push', 5), '(push 5)');
    test(TransactionOpMaker.makeWithCategory('pull', 1));
    test(TransactionOpMaker.makeWithCategory('pull', 2), '(pull 2)');
    test(TransactionOpMaker.makeWithCategory('pull', 5), '(pull 5)');
    test(TransactionOpMaker.makeWithCategory('wait', 1));
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
