// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import { FileOp } from './FileOp';
import { StoragePath } from './StoragePath';

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
export class FileDelta extends BaseDelta {
  /**
   * Implementation as required by the superclass.
   *
   * @override
   * @param {FileDelta} other Delta to compose with this instance.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {FileDelta} Composed result.
   */
  _impl_compose(other, wantDocument) {
    const opMap     = new Map();
    const deleteSet = wantDocument ? null : new Set();

    FileDelta._composeOne(opMap, deleteSet, this);
    FileDelta._composeOne(opMap, deleteSet, other);

    return FileDelta._composeResult(opMap, deleteSet);
  }

  /**
   * Implementation as suggested by the superclass.
   *
   * @override
   * @param {array<FileDelta>} deltas Instances to compose on top of this one.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {FileDelta} Composed result.
   */
  _impl_composeAll(deltas, wantDocument) {
    const opMap     = new Map();
    const deleteSet = wantDocument ? null : new Set();

    FileDelta._composeOne(opMap, deleteSet, this);
    for (const d of deltas) {
      FileDelta._composeOne(opMap, deleteSet, d);
    }

    return FileDelta._composeResult(opMap, deleteSet);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @override
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

  /** @override */
  static get _impl_opClass() {
    return FileOp;
  }

  /**
   * Helper for {@link #_impl_compose} and {@link #_impl_composeAll} which
   * performs one composition of a delta on top of a running composition result,
   * said running result which takes the form of a map from IDs to ops and an
   * optional set of multi-target delete operations (which is `null` for
   * document composes and required for non-document composes).
   *
   * **Note:** The deal with the `deletes` set is that multi-target deletes, in
   * general, cannot be dropped from a composition result because they will have
   * an effect when the composition result is itself used as the argument to
   * a later compose operation. (Single-target deletes can always be dropped if
   * they are "overwritten" by a later write operation with the exact same ID.)
   *
   * **Note the Second:** This implementation does not necessarily produce a
   * "canonical" or maximally compact result with regards to multi-target delete
   * operations, because (a) it does not try to remove redundancies from within
   * the deletes other than recognizing `deleteAll` as mooting the whole set
   * (e.g., `deletePathRange('/x', 1, 6)` and `deletePathRange('x/', 4, 10)`
   * would ideally combine to `deletePathRange('/x', 1, 10)`); and (b) it does
   * not trim / remove delete operations that intersect with subsequent writes
   * (e.g., `deletePathRange('/x', 1, 10)` followed by `writePath('/x/1')`
   * would ideally trim the resulting delete to
   * `deletePathRange('/x', 2, 10)`).
   *
   * @param {Map<string, FileOp>} opMap Map from IDs to corresponding file
   *   operations, representing the result of composition in progress. This
   *   method modifies the value.
   * @param {Set<FileOp>|null} deleteSet Set of multi-target delete operations,
   *   representing the result of composition in progress. This method modifies
   *   the value. If `null`, deletes are not tracked at all, either through
   *   this argument (of course) but also via `opMap`.
   * @param {FileDelta} delta Delta to compose with this running result as
   *   represented in the previous two arguments.
   */
  static _composeOne(opMap, deleteSet, delta) {
    const trackDeletes = (deleteSet !== null);

    for (const op of delta.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case FileOp.CODE_deleteAll: {
          opMap.clear();
          if (trackDeletes) {
            deleteSet.clear();
            deleteSet.add(op);
          }
          break;
        }

        case FileOp.CODE_deleteBlob: {
          if (trackDeletes) {
            opMap.set(opProps.hash, op);
          } else {
            opMap.delete(opProps.hash);
          }
          break;
        }

        case FileOp.CODE_deletePath: {
          if (trackDeletes) {
            opMap.set(opProps.path, op);
          } else {
            opMap.delete(opProps.path);
          }
          break;
        }

        case FileOp.CODE_deletePathPrefix: {
          const prefix = opProps.path;

          // **TODO:** This isn't necessarily the most efficient way to achieve
          // the desired result. Consider a cleverer solution, should this turn
          // out to be a performance issue.
          for (const id of opMap.keys()) {
            if (StoragePath.isInstance(id) && StoragePath.isPrefixOrSame(prefix, id)) {
              opMap.delete(id);
            }
          }

          if (trackDeletes) {
            deleteSet.add(op);
          }

          break;
        }

        case FileOp.CODE_deletePathRange: {
          const { path: prefix, startInclusive, endExclusive } = opProps;

          // **TODO:** This isn't necessarily the most efficient way to achieve
          // the desired result. Consider a cleverer solution, should this turn
          // out to be a performance issue.
          for (let n = startInclusive; n < endExclusive; n++) {
            opMap.delete(`${prefix}/${n}`);
          }

          if (trackDeletes) {
            deleteSet.add(op);
          }

          break;
        }

        case FileOp.CODE_writeBlob: {
          opMap.set(opProps.blob.hash, op);
          break;
        }

        case FileOp.CODE_writePath: {
          opMap.set(opProps.path, op);
          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }
  }

  /**
   * Helper for {@link #_impl_compose} and {@link #_impl_composeAll} which
   * produces a final result from the op map and delete set that were used for
   * a series of calls to {@link #_composeOne}.
   *
   * @param {Map<string, FileOp>} opMap Operatrion map used to build up a
   *   composition result.
   * @param {Set<FileOp>|null} deleteSet Set of multi-target delete operations,
   *   used to build up a composition result.
   * @returns {FileDelta} Final composition result.
   */
  static _composeResult(opMap, deleteSet) {
    const ops = (deleteSet === null)
      ? [...opMap.values()]
      : [...deleteSet.values(), ...opMap.values()];

    return new FileDelta(ops);
  }
}
