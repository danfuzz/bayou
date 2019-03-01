// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { TransactionOp } from '@bayou/file-store-ot';
import { CommonBase } from '@bayou/util-common';

import BaseFile from './BaseFile';

/**
 * Combination of a `BaseFile` with a `Codec`, with operations to make it easy
 * to perform file access and modification in a codec-aware fashion.
 *
 * The main thing this class provides is a set of instance methods for
 * constructing `FileOp`s operations, with the same method names as the static
 * constructor methods defined by that class.
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
   * {BaseFile} The file being used.
   */
  get file() {
    return this._file;
  }

  /**
   * {Codec} The codec being used.
   */
  get codec() {
    return this._codec;
  }

  /**
   * Adds `TransactionOp` constructor methods to this class. These are
   * _instance_ methods that are aware of the codec being used. (Look at the
   * bottom of this file for the call.)
   */
  static _addFileOpConstructorMethods() {
    const proto = FileCodec.prototype;
    for (const name of TransactionOp.OPERATION_NAMES) {
      const { args: argInfo } = TransactionOp.propsFromName(name);
      const methodName        = `op_${name}`;
      const originalMethod    = TransactionOp[methodName].bind(TransactionOp);

      // Figure out which arguments are buffers, if any.
      const bufferAt = [];
      for (let i = 0; i < argInfo.length; i++) {
        const [name_unused, type] = argInfo[i];
        if ((type === TransactionOp.TYPE_Buffer) || (type === TransactionOp.TYPE_Hash)) {
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

// Build and bind all the `TransactionOp` constructor methods.
FileCodec._addFileOpConstructorMethods();
