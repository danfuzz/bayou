// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { CommonBase, DataUtil } from 'util-common';
import { FrozenBuffer } from 'util-server';

import StoragePath from './StoragePath';

/**
 * {object} Private key used to protect the main constructor. This is used so
 * that only the static constructor methods can use it. This makes it less
 * likely that a bogus instance will get constructed (and pretty obvious if
 * someone writes code to try to sneak around the restriction, which ought to
 * be a red flag).
 */
const KEY = Object.freeze(['FileOp constructor key']);

/** {string} Operation category for prerequisites. */
const CAT_PREREQUISITE = 'prerequisite';

/** {string} Operation category for data reads. */
const CAT_READ = 'read';

/** {string} Operation category for revision restrictions. */
const CAT_REVISION = 'revision';

/** {string} Operation category for data writes. */
const CAT_WRITE = 'write';

/**
 * Operation to perform on a file as part of a transaction. In terms of overall
 * structure, an operation consists of a string name and arbitrary additional
 * arguments. Each specific named operation defines the allowed shape of its
 * arguments. Instances of this class are immutable. Operations can be
 * categorized as follows:
 *
 * * Revision restrictions &mdash; A revision restriction limits a transation
 *   to being based only on certain revisions of the file.
 * * Prerequisite checks &mdash; A prerequisite check must pass in order for
 *   the remainder of a transaction to apply.
 * * Data reads &mdsah; A data read gets the value of a blob within a file.
 * * Data writes &mdash; A data write stores new data in a file or erases
 *   previously-existing data within a file.
 *
 * There is a static method on this class to construct each named operation.
 * See documentation on those methods for details about the meaning and
 * arguments of these.
 *
 * When accessing instance arguments via `args`, the arguments for any given
 * operation are in the same order as used in the corresponding constructor.
 */
export default class FileOp extends CommonBase {
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
   * Constructs a `checkPathEmpty` operation. This is a prerequisite operation
   * that verifies that a given storage path is not bound to any value. This is
   * the opposite of the `checkPathExists` operation.
   *
   * @param {string} storagePath The storage path to check.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static checkPathEmpty(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathEmpty', storagePath);
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
  static checkPathExists(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathExists', storagePath);
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
  static checkPathHash(storagePath, hash) {
    StoragePath.check(storagePath);
    TString.nonempty(hash); // TODO: Better hash validation.
    return new FileOp(KEY, CAT_PREREQUISITE, 'checkPathHash', storagePath, hash);
  }

  /**
   * Constructs a `deletePath` operation. This is a write operation that
   * deletes the binding for the given path, if any. If the path wasn't bound,
   * then this operation does nothing.
   *
   * @param {string} storagePath The storage path to delete.
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static deletePath(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_WRITE, 'deletePath', storagePath);
  }

  /**
   * Constructs an inclusive `maxRevNum` operation. This is a convenience
   * method that is equivalent to calling `maxRevNum(revNum + 1)`.
   *
   * @param {Int} revNum Maximum revision number (inclusive).
   * @returns {FileOp} An appropriately-constructed instance.
   */
  static maxRevNumInc(revNum) {
    TInt.min(revNum, 0);
    return FileOp.maxRevNum(revNum + 1);
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
  static maxRevNum(revNum) {
    TInt.min(revNum, 1);
    return new FileOp(KEY, CAT_REVISION, 'maxRevNum', revNum);
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
  static minRevNum(revNum) {
    TInt.min(revNum, 0);
    return new FileOp(KEY, CAT_REVISION, 'minRevNum', revNum);
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
  static readPath(storagePath) {
    StoragePath.check(storagePath);
    return new FileOp(KEY, CAT_READ, 'readPath', storagePath);
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
  static writePath(storagePath, value) {
    StoragePath.check(storagePath);
    FrozenBuffer.check(value);
    return new FileOp(KEY, CAT_WRITE, 'writePath', storagePath, value);
  }

  /**
   * Constructs an instance. This should not be used directly. Instead use the
   * static constructor methods defined by this class.
   *
   * @param {object} constructorKey The private-to-this-module key that
   *   enforces the exhortation in the method documentation above.
   * @param {string} category The operation category.
   * @param {string} name The operation name.
   * @param {...*} args Arguments to the operation, if any.
   */
  constructor(constructorKey, category, name, ...args) {
    if (constructorKey !== KEY) {
      throw new Error('Constructor is private.');
    }

    super();

    /** {string} The operation category. */
    this._category = TString.nonempty(category);

    /** {string} The operation name. */
    this._name = TString.nonempty(name);

    /** {array<*>} The operation arguments. */
    this._args = DataUtil.deepFreeze(args);
  }

  /** {string} The operation category. */
  get category() {
    return this._category;
  }

  /** {string} The operation name. */
  get name() {
    return this._name;
  }

  /** {array<*>} The operation arguments. This is a deeply frozen value. */
  get args() {
    return this._args;
  }
}
