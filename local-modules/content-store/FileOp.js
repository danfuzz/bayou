// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TInt, TString } from 'typecheck';
import { CommonBase } from 'util-common';
import { FrozenBuffer } from 'util-server';

import StoragePath from './StoragePath';

/**
 * {Symbol} Private key used to protect the main constructor. This is used so
 * that only the static constructor methods can use it. This makes it less
 * likely that a bogus instance will get constructed (and pretty obvious if
 * someone writes code to try to sneak around the restriction, which ought to
 * be a red flag).
 */
const KEY = Symbol('FileOp constructor key');

/** {string} Operation category for environment ops. */
const CAT_ENVIRONMENT = 'environment';

/** {string} Operation category for prerequisites. */
const CAT_PREREQUISITE = 'prerequisite';

/** {string} Operation category for data reads. */
const CAT_READ = 'read';

/** {string} Operation category for revision restrictions. */
const CAT_REVISION = 'revision';

/** {string} Operation category for data writes. */
const CAT_WRITE = 'write';

/** {array<string>} List of categories in defined execution order. */
const CATEGORY_EXECUTION_ORDER = [
  CAT_ENVIRONMENT, CAT_REVISION, CAT_PREREQUISITE, CAT_READ, CAT_WRITE
];

/**
 * Operation to perform on a file as part of a transaction. In terms of overall
 * structure, an operation consists of a string name and arbitrary additional
 * arguments. Each specific named operation defines the allowed shape of its
 * arguments. Instances of this class are immutable. Operations can be
 * categorized as follows:
 *
 * * Environment ops &mdash; An environment operation performs some action or
 *   checks some aspect of the execution environment of the transaction.
 * * Revision restrictions &mdash; A revision restriction limits a transaction
 *   to being based only on certain revisions of the file.
 * * Prerequisite checks &mdash; A prerequisite check must pass in order for
 *   the remainder of a transaction to apply.
 * * Data reads &mdash; A data read gets the value of a blob within a file.
 * * Data writes &mdash; A data write stores new data in a file or erases
 *   previously-existing data within a file.
 *
 * When executed, the operations of a transaction are effectively performed in
 * order by category; but within a category there is no effective ordering.
 * Specifically, the category ordering is as listed above.
 *
 * There are static methods on this class to construct each named operation,
 * named `op_<name>`, as well as some convenience methods to construct variants.
 * See documentation on those methods for details about the meaning and
 * arguments of each of these.
 */
export default class FileOp extends CommonBase {
  /** {string} Operation category for environment ops. */
  static get CAT_ENVIRONMENT() {
    return CAT_ENVIRONMENT;
  }

  /** {string} Operation category for prerequisites. */
  static get CAT_PREREQUISITE() {
    return CAT_PREREQUISITE;
  }

  /** {string} Operation category for data reads. */
  static get CAT_READ() {
    return CAT_READ;
  }

  /** {string} Operation category for revision restrictions. */
  static get CAT_REVISION() {
    return CAT_REVISION;
  }

  /** {string} Operation category for data writes. */
  static get CAT_WRITE() {
    return CAT_WRITE;
  }

  /**
   * Sorts an `Iterable` (e.g. an array) of `FileOp`s by category, in the
   * prescribed order of execution. Within a category, the result's ordering is
   * arbitrary; that is, the sort is not guaranteed to be stable. The return
   * value is a newly-constructed array; the original input is left unmodified.
   *
   * @param {Iterable<FileOp>} orig `Iterable` collection of `FileOp`s to sort.
   * @returns {array<FileOp>} Array in the defined category-sorted order.
   */
  static sortByCategory(orig) {
    TArray.check(orig, FileOp.check);

    const result = [];

    for (const cat of CATEGORY_EXECUTION_ORDER) {
      for (const op of orig) {
        if (op.category === cat) {
          result.push(op);
        }
      }
    }

    return result;
  }

  /**
   * Validates a category string. Throws an error given an invalid category.
   *
   * @param {*} category The (alleged) category string.
   * @returns {string} `category` but only if valid.
   */
  static validateCategory(category) {
    switch (category) {
      case CAT_ENVIRONMENT:
      case CAT_PREREQUISITE:
      case CAT_READ:
      case CAT_REVISION:
      case CAT_WRITE: {
        return category;
      }
      default: {
        throw new Error(`Invalid category: ${category}`);
      }
    }
  }

  /**
   * Constructs a `checkPathEmpty` operation. This is a prerequisite operation
   * that verifies that a given storage path is not bound to any value. This is
   * the opposite of the `checkPathExists` operation.
   *
   * @param {string} storagePath The storage path to check.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_checkPathEmpty(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathEmpty',
      [['storagePath', storagePath]]);
  }

  /**
   * Constructs a `checkPathExists` operation. This is a prerequisite operation
   * that verifies that a given storage path is bound to a value (any value,
   * including one of zero length). This is the opposite of the `checkPathEmpty`
   * operation.
   *
   * @param {string} storagePath The storage path to check.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_checkPathExists(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathExists',
      [['storagePath', storagePath]]);
  }

  /**
   * Constructs a `checkPathHash` operation. This is a prerequisite operation
   * that verifies that a given storage path is bound to a value whose hash is
   * as given.
   *
   * @param {string} storagePath The storage path to check.
   * @param {string} hash The expected hash.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_checkPathHash(storagePath, hash) {
    StoragePath.check(storagePath);
    TString.nonempty(hash); // TODO: Better hash validation.
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathHash',
      [['storagePath', storagePath], ['hash', hash]]);
  }

  /**
   * Constructs a `deletePath` operation. This is a write operation that
   * deletes the binding for the given path, if any. If the path wasn't bound,
   * then this operation does nothing.
   *
   * @param {string} storagePath The storage path to delete.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_deletePath(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_WRITE, 'deletePath',
      [['storagePath', storagePath]]);
  }

  /**
   * Constructs a `maxRevNum` operation. This is a revision restriction that
   * limits a transaction to only be performed with respect to an earlier
   * revision number of the file than the indicated revision. That is, it
   * specifies an _exclusive_ maximum.
   *
    This is a convenience
   * method that is equivalent to calling `maxRevNum(revNum - 1)`.
   *
   * @param {Int} revNum Maximum revision number (exclusive).
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_maxRevNum(revNum) {
    TInt.min(revNum, 1);
    return new FileOp(KEY, CAT_REVISION, 'maxRevNum',
      [['revNum', revNum]]);
  }

  /**
   * Constructs an inclusive `maxRevNum` operation. This is a convenience
   * method that is equivalent to calling `maxRevNum(revNum + 1)`.
   *
   * @param {Int} revNum Maximum revision number (inclusive).
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_maxRevNumInc(revNum) {
    TInt.min(revNum, 0);
    return FileOp.maxRevNum(revNum + 1);
  }

  /**
   * Constructs a `minRevNum` operation. This is a revision restriction that
   * limits a transaction to only be performed with respect to the indicated
   * revision number of the file or later. That is, it specifies an inclusive
   * minimum.
   *
   * @param {Int} revNum Minimum revision number (inclusive).
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_minRevNum(revNum) {
    TInt.min(revNum, 0);
    return new FileOp(KEY, CAT_REVISION, 'minRevNum',
      [['revNum', revNum]]);
  }

  /**
   * Constructs a `readPath` operation. This is a read operation that retrieves
   * the value bound to the indicated path in the file, if any. If the given
   * path is not bound, then that path is _not_ represented in the result of the
   * transaction at all (specifically, it is _not_ bound to `null` or similar).
   *
   * @param {string} storagePath The storage path to read from.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_readPath(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_READ, 'readPath',
      [['storagePath', storagePath]]);
  }

  /**
   * Constructs a `timeout` operation. This is an environment operation which
   * limits a transaction to take no more than the indicated amount of time
   * before it is aborted. Timeouts are performed on a "best effort" basis as
   * well as silently clamped to implementation-specific limits (if any).
   *
   * **Note:** It is an error for a transaction to contain more than one
   * `timeout` operation.
   *
   * @param {Int} durMsec Duration of the timeout, in milliseconds.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_timeout(durMsec) {
    TInt.min(durMsec, 0);
    return new FileOp(KEY, CAT_ENVIRONMENT, 'timeout',
      [['durMsec', durMsec]]);
  }

  /**
   * Constructs a `writePath` operation. This is a write operation that stores
   * the indicated value in the file, binding it to the given path. If the path
   * was already bound to that value, then this operation does nothing.
   *
   * @param {string} storagePath The storage path to bind to.
   * @param {FrozenBuffer} value The value to store and bind to `storagePath`.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static op_writePath(storagePath, value) {
    StoragePath.check(storagePath);
    FrozenBuffer.check(value);
    return new FileOp(KEY, CAT_WRITE, 'writePath',
      [['storagePath', storagePath], ['value', value]]);
  }

  /**
   * Constructs an instance. This should not be used directly. Instead use the
   * static constructor methods defined by this class.
   *
   * @param {object} constructorKey The private-to-this-module key that
   *   enforces the exhortation in the method documentation above.
   * @param {string} category The operation category.
   * @param {string} name The operation name.
   * @param {array<array<*>>} args Arguments to the operation, in the form
   *   expected by the `Map` constructor.
   */
  constructor(constructorKey, category, name, args) {
    if (constructorKey !== KEY) {
      throw new Error('Constructor is private.');
    }

    super();

    /** {string} The operation category. */
    this._category = FileOp.validateCategory(category);

    /** {string} The operation name. */
    this._name = TString.nonempty(name);

    /** {Map<string,*>} Arguments to the operation. */
    this._args = new Map(args);

    Object.freeze(this);
  }

  /** {string} The operation category. */
  get category() {
    return this._category;
  }

  /** {string} The operation name. */
  get name() {
    return this._name;
  }

  /**
   * Gets the operation argument with the given name. It is an error to
   * request an argument that is not bound. Return values are guaranteed to be
   * deep frozen.
   *
   * @param {string} name The argument name.
   * @returns {*} Corresponding argument value.
   */
  arg(name) {
    const result = this._args.get(name);

    if (result === undefined) {
      throw new Error(`No such argument: ${name}`);
    }

    return result;
  }
}
