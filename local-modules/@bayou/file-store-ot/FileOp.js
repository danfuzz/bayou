// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';
import { TInt } from '@bayou/typecheck';
import { Errors, FrozenBuffer } from '@bayou/util-common';

import { StorageId } from './StorageId';
import { StoragePath } from './StoragePath';

/**
 * Operation which can be applied to a {@link FileSnapshot}.
 */
export class FileOp extends BaseOp {
  /** {string} Opcode constant for "delete all" operations. */
  static get CODE_deleteAll() {
    return 'deleteAll';
  }

  /** {string} Opcode constant for "delete path" operations. */
  static get CODE_deleteBlob() {
    return 'deleteBlob';
  }

  /** {string} Opcode constant for "delete path" operations. */
  static get CODE_deletePath() {
    return 'deletePath';
  }

  /** {string} Opcode constant for "delete path prefix" operations. */
  static get CODE_deletePathPrefix() {
    return 'deletePathPrefix';
  }

  /** {string} Opcode constant for "delete path range" operations. */
  static get CODE_deletePathRange() {
    return 'deletePathRange';
  }

  /** {string} Opcode constant for "write blob" operations. */
  static get CODE_writeBlob() {
    return 'writeBlob';
  }

  /** {string} Opcode constant for "write path" operations. */
  static get CODE_writePath() {
    return 'writePath';
  }

  /**
   * Constructs a new "delete all" operation. The effect of this operation is
   * to remove _all_ data from the file.
   *
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deleteAll() {
    return new FileOp(FileOp.CODE_deleteAll);
  }

  /**
   * Constructs a new "delete blob" operation. The effect of this operation is
   * to remove the content-addressed blob with the indicated hash from the file,
   * if it is in fact in the file. If it isn't in the file, then the operation
   * does nothing.
   *
   * @param {string|FrozenBuffer} hash Hash of the blob to delete, or a buffer
   *   whose hash is to be used as the blob identifier.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deleteBlob(hash) {
    hash = StorageId.checkOrGetHash(hash);

    return new FileOp(FileOp.CODE_deleteBlob, hash);
  }

  /**
   * Constructs a new "delete path" operation. The effect of this operation is
   * to remove any value binding for the indicated path, if the path is in fact
   * bound in the file. If it isn't bound, then the operation does nothing.
   *
   * @param {string} path Path to delete. Must be valid per {@link StoragePath}.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deletePath(path) {
    StoragePath.check(path);

    return new FileOp(FileOp.CODE_deletePath, path);
  }

  /**
   * Constructs a new "delete path prefix" operation. The effect of this
   * operation is to remove all value bindings for the indicated path and for
   * all bound paths which have the indicated path as a prefix, if any. If there
   * are no such bound paths in the file, then this operation does nothing.
   *
   * @param {string} path Path prefix to delete. Must be valid per {@link
   *   StoragePath}.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deletePathPrefix(path) {
    StoragePath.check(path);

    return new FileOp(FileOp.CODE_deletePathPrefix, path);
  }

  /**
   * Constructs a new "delete path range" operation. The effect of this
   * operation is to remove the value bindings for all paths immediately under
   * the given path prefix whose final components are in the form of
   * non-negative decimal numbers within the indicated range, if any. If there
   * are no such bound paths in the file, then this operation does nothing.
   *
   * For example, `deletePathPrefix('/x/y', 20, 23)` would possibly affect the
   * paths `/x/y/20`, `/x/y/21`, and `/x/y/22`; and no others.
   *
   * @param {string} path Path prefix for the values to delete. Must be valid
   *   per {@link StoragePath}.
   * @param {Int} startInclusive The start of the range to delete (inclusive).
   *   Must be `>= 0`.
   * @param {Int} endExclusive The end of the range to delete (exclusive). Must
   *   be `> startInclusive`.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deletePathRange(path, startInclusive, endExclusive) {
    StoragePath.check(path);
    TInt.nonNegative(startInclusive);
    TInt.min(endExclusive, startInclusive + 1);

    return new FileOp(FileOp.CODE_deletePathRange, path, startInclusive, endExclusive);
  }

  /**
   * Constructs a new "write blob" operation. The effect of this operation is to
   * store the indicated value as a content-addressable blob to the file. If the
   * blob had already been added, then the operation does nothing.
   *
   * @param {FrozenBuffer} blob Blob to store.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_writeBlob(blob) {
    FrozenBuffer.check(blob);

    return new FileOp(FileOp.CODE_writeBlob, blob);
  }

  /**
   * Constructs a new "write path" operation. The effect of this operation is to
   * store the indicated value as a path-addressable value to the file. If the
   * indicated path already stores that exact value, then the operation does
   * nothing.
   *
   * @param {string} path Storage path being written to. Must be valid per
   *   {@link StoragePath}.
   * @param {FrozenBuffer} blob Blob to store at the path.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_writePath(path, blob) {
    StoragePath.check(path);
    FrozenBuffer.check(blob);

    return new FileOp(FileOp.CODE_writePath, path, blob);
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * plain object. `opName` is always bound to the operation name. Other
   * bindings depend on the operation name. Guaranteed to be an immutable
   * object.
   */
  get props() {
    const payload = this._payload;
    const opName  = payload.name;

    switch (opName) {
      case FileOp.CODE_deleteAll: {
        return Object.freeze({ opName });
      }

      case FileOp.CODE_deleteBlob: {
        const [hash] = payload.args;
        return Object.freeze({ opName, hash });
      }

      case FileOp.CODE_deletePath:
      case FileOp.CODE_deletePathPrefix: {
        const [path] = payload.args;
        return Object.freeze({ opName, path });
      }

      case FileOp.CODE_deletePathRange: {
        const [path, startInclusive, endExclusive] = payload.args;
        return Object.freeze({ opName, path, startInclusive, endExclusive });
      }

      case FileOp.CODE_writeBlob: {
        const [blob] = payload.args;
        return Object.freeze({ opName, blob });
      }

      case FileOp.CODE_writePath: {
        const [path, blob] = payload.args;
        return Object.freeze({ opName, path, blob });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Implementation as required by the superclass.
   *
   * @override
   * @param {Functor} payload_unused The would-be payload for an instance.
   * @returns {boolean} `true` if `payload` is valid, or `false` if not.
   */
  static _impl_isValidPayload(payload_unused) {
    // **TODO:** Fill this in!
    return true;
  }
}
