// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from 'ot-common';
import { Errors, FrozenBuffer } from 'util-common';

import StoragePath from './StoragePath';

/**
 * Operation which can be applied to a {@link FileSnapshot}.
 */
export default class FileOp extends BaseOp {
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

  /** {string} Opcode constant for "write blob" operations. */
  static get CODE_writeBlob() {
    return 'writeBlob';
  }

  /** {string} Opcode constant for "write path" operations. */
  static get CODE_writePath() {
    return 'writePath';
  }

  /**
   * Constructs a new "delete all" operation.
   *
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deleteAll() {
    return new FileOp(FileOp.CODE_deleteAll);
  }

  /**
   * Constructs a new "delete blob" operation.
   *
   * @param {string|FrozenBuffer} hash Hash of the blob to delete, or a buffer
   *   whose hash is to be used as the blob identifier.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deleteBlob(hash) {
    if (hash instanceof FrozenBuffer) {
      hash = hash.hash;
    } else {
      FrozenBuffer.checkHash(hash);
    }

    return new FileOp(FileOp.CODE_deleteBlob, hash);
  }

  /**
   * Constructs a new "delete path" operation.
   *
   * @param {string} path Path to delete. Must be valid per {@link StoragePath}.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_deletePath(path) {
    StoragePath.check(path);

    return new FileOp(FileOp.CODE_deletePath, path);
  }

  /**
   * Constructs a new "write blob" operation.
   *
   * @param {FrozenBuffer} blob Blob to store.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_writeBlob(blob) {
    FrozenBuffer.check(blob);

    return new FileOp(FileOp.CODE_writeBlob, blob);
  }

  /**
   * Constructs a new "write path" operation.
   *
   * @param {string} path Storage path being written to. Must be valid per
   *   {@link StoragePath}.
   * @param {FrozenBuffer} blob Blob to store at the path.
   * @returns {FileOp} An appropriately-constructed operation.
   */
  static op_writePath(path, blob) {
    StoragePath.check(path);
    FrozenBuffer.check(blob);

    return new FileOp(FileOp.CODE_writePath, blob);
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

      case FileOp.CODE_deletePath: {
        const [path] = payload.args;
        return Object.freeze({ opName, path });
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
}
