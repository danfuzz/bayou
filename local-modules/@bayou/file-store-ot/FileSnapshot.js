// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';
import { TInt } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import { Errors as fileStoreOt_Errors } from './Errors';
import { FileChange } from './FileChange';
import { FileDelta } from './FileDelta';
import { FileOp } from './FileOp';
import { StorageId } from './StorageId';
import { StoragePath } from './StoragePath';

/**
 * Snapshot of file contents. Instances of this class are always frozen
 * (immutable).
 *
 * When thought of in terms of a map, instances of this class can be taken to
 * be maps from string keys to arbitrary data values.
 */
export class FileSnapshot extends BaseSnapshot {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information.
   * @param {FileDelta|array<FileOp>} contents A from-empty delta (or array of
   *   ops which can be used to construct same), representing all the path
   *   bindings and direct content-addressable blobs to include in the instance.
   */
  constructor(revNum, contents) {
    super(revNum, contents);

    /**
     * {Map<string, FileOp>} Map of storage ID to corresponding value, the
     * latter in the form of a `write*` operation of some sort.
     */
    this._values = new Map();

    // Fill in `_values`.
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_writeBlob: {
          this._values.set(opProps.blob.hash, op);
          break;
        }

        case FileOp.CODE_writePath: {
          this._values.set(opProps.path, op);
          break;
        }

        default: {
          // Should have been prevented by the `isDocument()` check performed by
          // the superclass.
          throw Errors.wtf('Weird op');
        }
      }
    }

    Object.freeze(this._values);
    Object.freeze(this);
  }

  /**
   * {Int} The number of blobs stored by this instance, either via paths or as
   * direct content-addressable blobs.
   *
   * **Note:** This has identical semantics to the `Map` property of the same
   * name.
   */
  get size() {
    return this.contents.ops.length;
  }

  /**
   * Gets an iterator over the `[id, value]` entries that make up the snapshot.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name.
   *
   * @yields {[string, FrozenBuffer]} Snapshot entries. The keys are the storage
   *   IDs, and the values are the corresponding stored blobs.
   */
  * entries() {
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_writeBlob: {
          const { blob } = opProps;
          yield [blob.hash, blob];
          break;
        }

        case FileOp.CODE_writePath: {
          const { path, blob } = opProps;
          yield [path, blob];
          break;
        }

        default: {
          // Should have been prevented by the `isDocument()` check performed
          // during construction.
          throw Errors.wtf('Weird op');
        }
      }
    }
  }

  /**
   * Compares this to another possible-instance, for equality of content.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof FileSnapshot)) {
      return false;
    }

    const thisValues  = this._values;
    const otherValues = other._values;

    if (   (this.revNum     !== other.revNum)
        || (thisValues.size !== otherValues.size)) {
      return false;
    }

    for (const [id, op] of thisValues) {
      if (!op.equals(otherValues.get(id))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets the value for the given storage ID, if bound. Throws an error if `id`
   * is not bound..
   *
   * **Note:** This differs from the semantics of the `Map` method of the same
   * name in that the not-found case is an error.
   *
   * @param {string} id Storage ID to look up.
   * @returns {FrozenBuffer} Corresponding value.
   */
  get(id) {
    const found = this.getOrNull(id);

    if (found) {
      return found;
    }

    throw Errors.badUse(`No such ID: ${id}`);
  }

  /**
   * Gets the value for the given storage ID, if bound.
   *
   * @param {string} id Storage ID to look up.
   * @returns {FrozenBuffer|null} Corresponding value, or `null` if there is
   *   none.
   */
  getOrNull(id) {
    StorageId.check(id);

    const found = this._values.get(id);

    return found ? found.props.blob : null;
  }

  /**
   * Gets a map of all bindings for paths which have the indicated prefix,
   * including the prefix itself if it is bound.
   *
   * @param {string} prefix Storage path prefix.
   * @returns {Map<string,FrozenBuffer>} Map from full storage paths to their
   *   respective stored values, for all paths at or under the indicated
   *   `prefix` which are bound.
   */
  getPathPrefix(prefix) {
    StoragePath.check(prefix);

    // **TODO:** For snapshots with a lot of bound values, doing a full
    // iteration might not be such a good idea. Consider other options (notably,
    // actually representing the hierarchy instead of just a flat map), should
    // this implementation turn out to be a performance bottleneck.

    const result = new Map();

    for (const [id, value] of this.entries()) {
      if (StoragePath.isInstance(id) && StoragePath.isPrefixOrSame(prefix, id)) {
        result.set(id, value);
      }
    }

    return result;
  }

  /**
   * Gets a map of all bindings for paths whose leaf names are in a numeric
   * range, under a specific prefix. The range is of non-negative numbers, and
   * the leaf names are all represented as decimal character sequences with no
   * leading zeroes (except in the case of `0` itself, which is represented as
   * such).
   *
   * @param {string} prefix Storage path prefix.
   * @param {Int} startInclusive Start of the numeric range. Must be `>= 0`.
   * @param {Int} endExclusive End of the numeric range. Must be
   *   `> startInclusive`.
   * @returns {Map<string,FrozenBuffer>} Map from full storage paths to their
   *   respective stored values, for all paths in the indicated range that are
   *   bound.
   */
  getPathRange(prefix, startInclusive, endExclusive) {
    StoragePath.check(prefix);
    TInt.nonNegative(startInclusive);
    TInt.min(endExclusive, startInclusive + 1);

    // **TODO:** For large sparsely-covered ranges, doing a full iteration over
    // all the paths might not be such a good idea. Consider other options,
    // should this implementation turn out to be a performance bottleneck.

    const result = new Map();

    for (let n = startInclusive; n < endExclusive; n++) {
      const path = `${prefix}/${n}`;
      const got  = this.getOrNull(path);

      if (got !== null) {
        result.set(path, got);
      }
    }

    return result;
  }

  /**
   * Runs the test for `pathIs` operations.
   *
   * @param {string} path Storage path to check.
   * @param {string|FrozenBuffer} hash Hash of the blob to compare to what is
   *   stored at `path`, or a buffer whose hash is to be used as the blob
   *   identifier.
   * @throws {InfoError} pathHashMismatch error, usually occurs if caller
   *   lost append race.
   */
  checkPathIs(path, hash) {
    StoragePath.check(path);
    hash = StorageId.checkOrGetHash(hash);

    const pathResult = this.getOrNull(path);
    const passed = (pathResult !== null) && (pathResult.hash === hash);

    if (!passed) {
      throw fileStoreOt_Errors.pathHashMismatch(path, hash);
    }
  }

  /**
   * Runs the test for `pathAbsent` operations.
   *
   * @param {string} path Storage path to check for the absence of.
   * @throws {InfoError} pathNotAbsent error, usually occurs if caller
   *   lost append race.
   */
  checkPathAbsent(path) {
    StoragePath.check(path);

    const passed = this.getOrNull(path) === null;

    if (!passed) {
      throw fileStoreOt_Errors.pathNotAbsent(path);
    }
  }

  /**
   * Runs the test for `pathPresent` operations.
   *
   * @param {string} path Storage path to check for presence of.
   * @throws {InfoError} pathNotPresent error.
   */
  checkPathPresent(path) {
    StoragePath.check(path);

    const passed = this.getOrNull(path) !== null;

    if (!passed) {
      throw fileStoreOt_Errors.pathNotPresent(path);
    }
  }

  /**
   * Runs the test for `pathIsNot` operations.
   *
   * @param {string} path Storage path to compare hash against.
   * @param {object} hash Hash to compare.
   * @returns {boolean} Test result.
   */
  checkPathIsNot(path, hash) {
    StoragePath.check(path);
    hash = StorageId.checkOrGetHash(hash);

    const dataFromPath = this.getOrNull(path);

    return (dataFromPath === null) || (dataFromPath.hash !== hash);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @override
   * @param {FileSnapshot} newerSnapshot Snapshot to take the difference from.
   * @returns {FileDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  _impl_diffAsDelta(newerSnapshot) {
    const thisValues  = this._values;
    const newerValues = newerSnapshot._values;
    const resultOps   = [];

    // Find values that are new or updated from `this` when going to
    // `newerSnapshot`.
    for (const [id, op] of newerValues) {
      if (!op.equals(thisValues.get(id))) {
        // The newer snapshot has a value that is new or updated compared to
        // this one.
        resultOps.push(op);
      }
    }

    // Find values removed from `this` when going to `newerSnapshot`.
    for (const id of thisValues.keys()) {
      if (!newerValues.get(id)) {
        if (StoragePath.isInstance(id)) {
          resultOps.push(FileOp.op_deletePath(id));
        } else {
          resultOps.push(FileOp.op_deleteBlob(id));
        }
      }
    }

    // Build the result.
    return new FileDelta(resultOps);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @override
   * @param {FileChange} change The change to be validated in the context of
   *   `this`.
   * @throws {Error} Thrown if `change` is not valid to compose with `this`.
   */
  _impl_validateChange() {
    // **TODO:** Implement this!
  }

  /** @override */
  static get _impl_changeClass() {
    return FileChange;
  }
}
