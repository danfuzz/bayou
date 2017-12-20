// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Babel's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { TBuffer, TInt } from 'typecheck';
import { CommonBase, Errors } from 'util-core';

/** {string} Node's name for the hashing algorithm to use. */
const NODE_HASH_NAME = 'sha256';

/** {string} Public (exposed) name for the hashing algorithm. */
const PUBLIC_HASH_NAME = 'sha3';

/** {Int} Length of hashes used, in bits. */
const HASH_BIT_LENGTH = 256;

/**
 * Immutable buffer of data.
 */
export default class FrozenBuffer extends CommonBase {
  /**
   * Validates that the given value is a valid hash string, such as might be
   * returned by the instance property `.hash` on this class. Throws an error if
   * given an invalid value.
   *
   * @param {*} value The (alleged) hash value.
   * @returns {string} `value`, assuming it is indeed a valid hash string.
   */
  static checkHash(value) {
    if (FrozenBuffer.isHash(value)) {
      return value;
    }

    throw Errors.badValue(value, 'FrozenBuffer hash');
  }

  /**
   * Indicates whether or not the given value is a valid hash string, such as
   * might be returned by the instance property `.hash` on this class.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if `value` is a valid hash string, or `false` if
   *   not.
   */
  static isHash(value) {
    if (typeof value !== 'string') {
      return false;
    }

    // Validate the fields.

    const match = value.match(/^=([a-z0-9]+)_([1-9a-f][0-9a-f]*|0)_([0-9a-f]+)/);

    if (match === null) {
      return false;
    }

    const algorithm = match[1];
    const length    = match[2];
    const digest    = match[3];

    if (   (algorithm !== PUBLIC_HASH_NAME)
        || (length.length > 8)
        || (digest.length !== (HASH_BIT_LENGTH / 4))) {
      return false;
    }

    return true;
  }

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
      throw Errors.badValue(value, 'Buffer|string');
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
    this._buffer = isBuffer ? value : Buffer.from(value);

    /**
     * {string|null} Hashcode of the data, or `null` if not yet calculated.
     */
    this._hash = null;

    Object.seal(this);
  }

  /** {Int} Length of hash used by this instance, in bits. */
  get hashLength() {
    return HASH_BIT_LENGTH;
  }

  /** {string} Name of the hashing algorithm used by this instance. */
  get hashName() {
    return PUBLIC_HASH_NAME;
  }

  /**
   * {string} Hashcode of the data. This is a string of the form
   * `=<algorithm>_<length>_<digest>`, where the first part names the hashing
   * algorithm used, the second indicates the data length, and the last is the
   * hash digest value per se. The length and hash are represented in lowercase
   * hexadecimal. The length is _not_ zero-padded, and the hash contains
   * exactly enough characters to indicate its length (and so may have an
   * arbitrary number of leading zeroes).
   *
   * The `=` at the beginning unambiguously identifies this as a hash, in
   * contexts where hashes might be mixed with (filesystem-like) storage paths.
   */
  get hash() {
    if (this._hash === null) {
      const buf  = this._ensureBuffer();
      const hash = crypto.createHash(NODE_HASH_NAME);

      hash.update(buf);

      const name   = PUBLIC_HASH_NAME;
      const length = Number(buf.length).toString(16);
      const digest = hash.digest('hex');

      this._hash = `=${name}_${length}_${digest}`;
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
   * Tests whether this and another instance have the same contents.
   *
   * @param {FrozenBuffer} other Buffer to compare to.
   * @returns {boolean} `true` iff `this` and `other` have the same contents.
   */
  equals(other) {
    FrozenBuffer.check(other);

    const thisBuf = this._ensureBuffer();
    const otherBuf = other._ensureBuffer();
    return thisBuf.equals(otherBuf);
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
