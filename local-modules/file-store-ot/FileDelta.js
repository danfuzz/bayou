// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from 'ot-common';
import { Errors } from 'util-common';

import FileOp from './FileOp';

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

    if (wantDocument) {
      // For document deltas, we just need to remember the final contents.
      // Therefore, we ignore all of the deletion ops here (including any
      // recorded `deleteAll`).

      const ops = [];

      for (const op of ids.values()) {
        switch (op.props.opName) {
          case FileOp.CODE_writeBlob:
          case FileOp.CODE_writePath: {
            ops.push(op);
            break;
          }
        }
      }

      return new FileDelta(ops);
    } else {
      // For non-document deltas, we need to remember whether there was a
      // `deleteAll` and also remember IDs that got deleted, so that the
      // deletions are part of the result delta.

      const ops = [
        ...((deleteAllOp === null) ? [] : [deleteAllOp]),
        ...ids.values()
      ];

      return new FileDelta(ops);
    }
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
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return FileOp;
  }
}
