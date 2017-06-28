// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';
import { CommonBase } from 'util-common';

import BaseFile from './BaseFile';

/**
 * Combination of a `BaseFile` with a `Codec`, with operations to make it easy
 * to build transactions and interpret their results with respect to API-coded
 * values.
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
   * in the `data`.
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
}
