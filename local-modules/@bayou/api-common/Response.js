// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt, TObject, TString } from '@bayou/typecheck';
import { CommonBase, ErrorUtil, Errors, Functor, InfoError } from '@bayou/util-common';

import { CodableError } from './CodableError';

/**
 * Payload sent as a response to a method call.
 *
 * **Note:** In the case of error responses, the given `error` is converted so
 * that it is always something that is expected to be codable across the API,
 * such that it will be decoded into an `Error` instance of some sort on the
 * far side of the connection.
 */
export class Response extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int|string} id Message ID, used to match requests and responses.
   *   Must be a non-negative integer or a string of at least eight characters.
   * @param {*} result Non-error result. Must be `null` if `error` is non-`null`
   *   (but note that `null` is a valid non-error result).
   * @param {Error|null} [error = null] Error response, or `null` if there is no
   *   error. `null` here definitively indicates that the instance is not
   *   error-bearing.
   */
  constructor(id, result, error = null) {
    super();

    // Validate the `error` / `result` combo.
    if ((result !== null) && (error !== null)) {
      throw Errors.badUse('`result` and `error` cannot both be non-`null`.');
    }

    /** {Int|string} Message ID. */
    this._id = ((typeof id) === 'number')
      ? TInt.nonNegative(id)
      : TString.minLen(id, 8);

    /**
     * {*} Non-error result, if any. Always `null` if this is an error
     * response.
     */
    this._result = result;

    /**
     * {Error|null} The original error, or `null` if this is a non-error
     * response. Intended to be used for logging.
     */
    this._originalError = (error === null) ? null : TObject.check(error, Error);

    /**
     * {CodableError|null} Error response, or `null` if this instance doesn't
     * represent an error. This value is suitable for transmission across an API
     * boundary, with the caveat that it requires the `Codec` which encodes the
     * error to be able to encode all of the bits of any {@link InfoError}
     * payload.
     */
    this._error = Response._fixError(error);

    Object.freeze(this);
  }

  /**
   * {CodableError|null} Error result, or `null` if this instance doesn't
   * represent an error. This value is guaranteed to be suitable for encoding
   * across an API boundary, with the caveat that it requires the `Codec` which
   * encodes the error to be able to encode all of the bits of any {@link
   * InfoError} payload.
   */
  get error() {
    return this._error;
  }

  /**
   * {Error|null} The original error, or `null` if this is a non-error
   * response. Intended to be used for logging.
   */
  get originalError() {
    return this._originalError;
  }

  /**
   * {array<string>|null} Clean error trace (including message and causes if
   * any) of the original error, or `null` if this instance doesn't represent an
   * error.
   */
  get originalTrace() {
    const error = this._originalError;

    return (error === null) ? null : ErrorUtil.fullTraceLines(error);
  }

  /** {Int} Message ID. */
  get id() {
    return this._id;
  }

  /**
   * {*} Non-error result. Always `null` if this instance represents an error.
   */
  get result() {
    return this._result;
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    // Avoid returning a `null` error argument. This is ever so slightly nicer
    // should this result be used for encoding across an API boundary.
    return (this._error === null)
      ? [this._id, this._result]
      : [this._id, null, this._error];
  }

  /**
   * Indicates whether or not this is an error-bearing instance.
   *
   * @returns {boolean} `true` if this is an error-bearing instance, or `false`
   *   if not.
   */
  isError() {
    return (this._error !== null);
  }

  /**
   * Constructs an instance just like this one, except with a very
   * conservatively-defined error to replace the one in this instance.
   * Specifically, the replacement error flattens any structured error payload
   * from an {@link InfoError} (or subclass) to a string, to avoid object
   * encoding problems (such as not having a codec suitable for a would-be
   * encoded value).
   *
   * **Note:** If this instance has no error, this method returns `this`.
   *
   * @returns {Response} A suitably-constructed instance.
   */
  withConservativeError() {
    if (!this.isError()) {
      return this;
    }

    const info       = this.error.info;
    const infoString = inspect(info.args);
    const newInfo    = new Functor(info.name, infoString);

    return new Response(this._id, null, new CodableError(newInfo));
  }

  /**
   * Fixes up an incoming `error` argument. `null` gets returned as-is.
   * Everything else gets converted into a `CodableError` of some sort.
   *
   * @param {*} error Error value.
   * @returns {CodableError|null} Cleaned up error value.
   */
  static _fixError(error) {
    if (error === null) {
      return null;
    } else if (error instanceof CodableError) {
      return error;
    } else if (error instanceof InfoError) {
      // Adopt the functor of the error. Lose the cause (if any), exact class
      // identity, and stack.
      return new CodableError(error.info);
    } else {
      // Adopt the message. Lose the rest of the info.
      return CodableError.generalError(error.message);
    }
  }
}
