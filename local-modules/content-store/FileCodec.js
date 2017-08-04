// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';
import { CommonBase } from 'util-common';

import BaseFile from './BaseFile';
import FileOp from './FileOp';

/**
 * Combination of a `BaseFile` with a `Codec`, with operations to make it easy
 * to build transactions and interpret their results with respect to API-coded
 * values.
 *
 * In addition to instance methods that mirror `BaseFile`, this class also
 * defines a set of instance methods for constructing transaction operations,
 * that is, instances of `FileOp`, with the same method names as the static
 * constructor methods defined by `FileOp`. In the case of the methods defined
 * here, instead of accepting `FrozenBuffer` arguments where `FileOp` so defines
 * them, this class accepts any objects at all, so long as they can successfully
 * be encoded by the codec with which the instance of this class was
 * instantiated.
 *
 * **Note:** This class is _intentionally_ not a full wrapper over `BaseFile`.
 * It _just_ provides operations that benefit from the application of a `Codec`.
 */
export default class FileCodec extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseFile} file The file to use.
   * @param {Codec} codec The codec to use.
   */
  constructor(file, codec) {
    super();

    /** {BaseFile} The file to use. */
    this._file = BaseFile.check(file);

    /** {Codec} The codec to use. */
    this._codec = Codec.check(codec);

    Object.freeze(this);
  }

  /**
   * Runs the specified transaction, automatically decoding any values returned
   * in the `data`. This method passes through any errors thrown due to failure
   * to decode a buffer.
   *
   * @param {TransactionSpec} spec Specification for the transaction, that is,
   *   the set of operations to perform.
   * @returns {object} Object with mappings as described in
   *   `BaseFile.transact()`, except that mappings in `data` bind to decoded
   *   values and not raw buffers.
   * @throws {InfoError} Thrown if the transaction failed. Errors so thrown
   *   contain details sufficient for programmatic understanding of the issue.
   */
  async transact(spec) {
    const result  = await this._file.transact(spec);
    const rawData = result.data;

    if (rawData === undefined) {
      return result;
    }

    const cookedData = new Map();
    for (const [storagePath, value] of rawData) {
      cookedData.set(storagePath, this._codec.decodeJsonBuffer(value));
    }

    result.data = cookedData;
    return result;
  }

  /**
   * Adds `FileOp` constructor methods to this class. These are _instance_
   * methods that are aware of the codec being used. (Look at the bottom of
   * this file for the call.)
   */
  static _addFileOpConstructorMethods() {
    const proto = FileCodec.prototype;
    for (const [category_unused, opName, ...argInfo] of FileOp.OPERATIONS) {
      const methodName = `op_${opName}`;
      const originalMethod = FileOp[methodName].bind(FileOp);

      // Figure out which arguments are buffers, if any.
      const bufferAt = [];
      for (let i = 0; i < argInfo.length; i++) {
        const [name_unused, type] = argInfo[i];
        if (type === FileOp.TYPE_BUFFER) {
          bufferAt.push(i);
        }
      }

      if (bufferAt.length !== 0) {
        // There's at least one buffer argument, so create a wrapper constructor
        // that uses the codec to encode those arguments. **Note:** We use
        // `function` here because this is getting bound as an instance method,
        // and we want it to receive the instance's `this`.
        proto[methodName] = function (...args) {
          for (const argNum of bufferAt) {
            args[argNum] = this._codec.encodeJsonBuffer(args[argNum]);
          }
          return originalMethod(...args);
        };
      } else {
        // No buffer argument(s), so just bind the original directly.
        proto[methodName] = originalMethod;
      }
    }
  }
}

// Build and bind all the `FileOp` constructor methods.
FileCodec._addFileOpConstructorMethods();
