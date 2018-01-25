// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from 'ot-common';
import { Errors } from 'util-common';

import FileOp from './FileOp';
import StoragePath from './StoragePath';

/**
 * Delta for file contents, consisting of a simple ordered list of operations.
 * Instances of this class can be applied to instances of {@link FileSnapshot}
 * to produce updated snapshots.
 *
 * **Note:** To be valid as a document delta, the set of operations must (a)
 * not have any deletion ops, and (b) not mention any given path or hash more
 * than once.
 *
 * Instances of this class are immutable.
 */
export default class FileDelta extends BaseDelta {
  /**
   * Main implementation of {@link #compose}.
   *
   * @param {FileDelta} other Delta to compose with this instance.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {FileDelta} Composed result.
   */
  _impl_compose(other, wantDocument) {
    return wantDocument
      ? this._composeDocument(other)
      : this._composeNonDocument(other);
  }

  /**
   * Main implementation of {@link #isDocument}.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    const ids = new Set();

    for (const op of this.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_writeBlob: {
          const hash = opProps.blob.hash;

          if (ids.has(hash)) {
            return false;
          }

          ids.add(hash);
          break;
        }

        case FileOp.CODE_writePath: {
          const path = opProps.path;

          if (ids.has(path)) {
            return false;
          }

          ids.add(path);
          break;
        }

        default: {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Helper for {@link #_impl_compose} which handles the case of `wantDocument
   * === true`.
   *
   * @param {FileDelta} other Delta to compose with this instance.
   * @returns {FileDelta} Composed result.
   */
  _composeDocument(other) {
    const data = new Map();

    // Add / replace the ops, first from `this` and then from `other`, as a
    // mapping from the storage ID.
    for (const op of [...this.ops, ...other.ops]) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_deleteAll: {
          data.clear();
          break;
        }

        case FileOp.CODE_deleteBlob: {
          data.delete(opProps.hash);
          break;
        }

        case FileOp.CODE_deletePath: {
          data.delete(opProps.path);
          break;
        }

        case FileOp.CODE_deletePathPrefix: {
          const prefix = opProps.path;

          for (const id of data.keys()) {
            if (StoragePath.isInstance(id) && StoragePath.isPrefixOrSame(prefix, id)) {
              data.delete(id);
            }
          }

          break;
        }

        case FileOp.CODE_deletePathRange: {
          const { path: prefix, startInclusive, endExclusive } = opProps;

          // **TODO:** This isn't necessarily the most efficient way to achieve
          // the desired result. Consider a cleverer solution, should this turn
          // out to be a performance issue.
          for (let n = startInclusive; n < endExclusive; n++) {
            data.delete(`${prefix}/${n}`);
          }

          break;
        }

        case FileOp.CODE_writeBlob: {
          data.set(opProps.blob.hash, op);
          break;
        }

        case FileOp.CODE_writePath: {
          data.set(opProps.path, op);
          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }

    // Convert the map to an array of ops, and construct the result therefrom.
    return new FileDelta([...data.values()]);
  }

  /**
   * Helper for {@link #_impl_compose} which handles the case of `wantDocument
   * === false`. Notably, in this case, the result has to include any `delete*`
   * operations from `this` and `other` which could possibly have an effect
   * should the result be used as the argument to a subsequent call to
   * `compose()`.
   *
   * @param {FileDelta} other Delta to compose with this instance.
   * @returns {FileDelta} Composed result.
   */
  _composeNonDocument(other) {
    const ids         = new Map();
    let   deleteAllOp = null;

    // Add / replace the ops, first from `this` and then from `other`, as a
    // mapping from the storage ID.
    for (const op of [...this.ops, ...other.ops]) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_deleteAll: {
          deleteAllOp = op;
          ids.clear();
          break;
        }

        case FileOp.CODE_deleteBlob: {
          ids.set(opProps.hash, op);
          break;
        }

        case FileOp.CODE_deletePath: {
          ids.set(opProps.path, op);
          break;
        }

        case FileOp.CODE_writeBlob: {
          ids.set(opProps.blob.hash, op);
          break;
        }

        case FileOp.CODE_writePath: {
          ids.set(opProps.path, op);
          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }

    // Convert the map to an array of ops, and construct the result therefrom.

    const ops = [
      ...((deleteAllOp === null) ? [] : [deleteAllOp]),
      ...ids.values()
    ];

    return new FileDelta(ops);
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return FileOp;
  }
}
