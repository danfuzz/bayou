// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import crypto from 'crypto';

import { TInt, TypeError } from 'typecheck';
import { TBuffer } from 'typecheck-server';
import { CommonBase } from 'util-common';

/** {string} Name of the hashing algorithm to use. */
const HASH_NAME = 'sha256';

/**
 * Immutable buffer of data.
 */
export default class FrozenBuffer extends CommonBase {
  /**
   * Main coercion implementation, per the superclass documentation. In this
   * case, it merely tries to construct an instance with the given argument.
   *
   * @param {Buffer|string} value The value to coerce.
   * @returns {FrozenBuffer} The corresponding instance.
   */
  static _impl_coerce(value) {
    // Note: The base class implementation guarantees that we won't get called
    // on an instance of this class.
    return new FrozenBuffer(value);
  }

  /**
   * Constructs an instance. If constructed from a string, this converts it via
   * UTF-8 encoding.
   *
   * @param {Buffer|string} value Contents of the buffer.
   */
  constructor(value) {
    const isString = (typeof value === 'string');
    const isBuffer = Buffer.isBuffer(value);

    if (!(isString || isBuffer)) {
      TypeError.badValue(value, 'Buffer|string');
    }

    super();

    /** {string|null} String value, if constructed from a string. */
    this._string = isString ? value : null;

    /**
     * {Buffer|null} Buffer value, if constructed from a buffer or if the
     * string value has been converted. Guranteed to not be exposed outside
     * this class. In particular, if the constructor was given a buffer for
     * `value`, we clone it here to guarantee safe use.
     */
    this._buffer = isBuffer ? Buffer.from(value) : value;

    /**
     * {string|null} Hashcode of the data, or `null` if not yet calculated.
     */
    this._hash = null;

    Object.seal(this);
  }

  /** {string} Name of the hashing algorithm used by this instance. */
  get hashName() {
    return HASH_NAME;
  }

  /**
   * {string} Hashcode of the data. This is a string of the form
   * `<algorithm>-<hex>`, where the former names the hashing algorithm used and
   * the latter is the lowercase-hex value of the hashcode per se.
   */
  get hash() {
    if (this._hash === null) {
      const hash = crypto.createHash(HASH_NAME);

      if (this._buffer !== null) {
        hash.update(this._buffer);
      } else {
        hash.update(this._string, 'utf8');
      }

      this._hash = `${HASH_NAME}-${hash.digest('hex')}`;
    }

    return this._hash;
  }

  /** {Int} The length of the buffer in bytes. */
  get length() {
    const buf = this._ensureBuffer();
    return buf.length;
  }

  /**
   * {string} The contents of this buffer as a string. Buffer bytes are
   * interpreted via UTF-8 decoding.
   */
  get string() {
    if (this._string === null) {
      this._string = this._buffer.toString('utf8');
    }

    return this._string;
  }

  /**
   * Copies the contents of the buffer, or a portion thereof, into another
   * buffer. Arguments and return value are all the same as the built-in method
   * `Buffer.copy()`.
   *
   * @param {Buffer} target Destination of the copy.
   * @param {Int} [targetStart = 0] Offset within `target` for the start of the
   *   copy.
   * @param {Int} [sourceStart = 0] Offset within `this` for the start of the
   *   copy.
   * @param {Int} [sourceEnd = this.length] Offset within `this` for the end of
   *   the copy (exclusive).
   * @returns {Int} The number of bytes copied. This will be `sourceEnd -
   *   sourceStart` unless the target does not have that much space at
   *   `targetStart`. In the latter case, a copy is made of whatever will fit
   *   and the actual number of bytes copied is returned.
   */
  copy(target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
    TBuffer.check(target);
    TInt.check(targetStart);
    TInt.check(sourceStart);
    TInt.check(sourceEnd);

    const buf = this._ensureBuffer();
    return buf.copy(target, targetStart, sourceStart, sourceEnd);
  }

  /**
   * Gets a fresh `Buffer` with the contents of this instance.
   *
   * @returns {Buffer} A buffer whose contents match this instance's.
   */
  toBuffer() {
    return Buffer.from(this._ensureBuffer());
  }

  /**
   * Ensures that `_buffer` has been set.
   *
   * @returns {Buffer} The value of `_buffer`.
   */
  _ensureBuffer() {
    if (this._buffer === null) {
      this._buffer = Buffer.from(this._string, 'utf8');
    }

    return this._buffer;
  }
}
