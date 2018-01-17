// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from 'ot-common';
import { TString } from 'typecheck';
import { Errors } from 'util-common';

import FileChange from './FileChange';
import FileDelta from './FileDelta';
import FileOp from './FileOp';
import StoragePath from './StoragePath';

/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 *
 * When thought of in terms of a map, instances of this class can be taken to
 * be maps from string keys to arbitrary data values.
 */
export default class FileSnapshot extends BaseSnapshot {
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
          this._values.set(opProps.property.blob.hash, op);
          break;
        }

        case FileOp.CODE_writePath: {
          this._values.set(opProps.property.path, op);
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
    TString.nonEmpty(id); // TODO: Should be `StorageId.check()`.

    const found = this._values.get(id);

    return found ? found.props.blob : null;
  }

  /**
   * Main implementation of {@link #diff}, which produces a delta (not a
   * change).
   *
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
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return FileChange;
  }
}
