// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { CommonBase } from '@bayou/util-common';

import { BaseFile } from './BaseFile';

/**
 * Combination of a `BaseFile` with a `Codec`.
 *
 * **Note:** In an earlier version of this system, this class had methods that
 * helped construct file operations which were codec-aware, which is why this
 * class exists. However, those methods got obsoleted with the transition of the
 * `file-store` layer to an OT-based approach. That said, it is reasonable to
 * believe that at some point we will once again introduce these sorts of
 * methods.
 */
export class FileCodec extends CommonBase {
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
}
