// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt } from 'typecheck';
import { CommonBase, ErrorUtil, Errors, Functor, InfoError } from 'util-common';

import CodableError from './CodableError';

/**
 * Payload sent as a response to a method call.
 *
 * **Note:** In the case of error responses, the given `error` is converted so
 * that it is always something that is expected to be codable across the API,
 * such that it will be decoded into an `Error` instance of some sort on the
 * far side of the connection.
 */
export default class Response extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} id Message ID, used to match requests and responses. Must be
   *   a non-negative integer.
   * @param {*} result Non-error result. Must be `null` if `error` is non-`null`
   *   (but note that `null` is a valid non-error result).
   * @param {*|null} error Error response, or `null` if there is no error.
   *   `null` here definitively indicates that the instance is not
   *   error-bearing.
   */
  constructor(id, result, error) {
    super();

    // Validate the `error`/`result` combo.
    if ((result !== null) && (error !== null)) {
      throw Errors.bad_use('`result` and `error` cannot both be non-`null`.');
    }

    /** {Int} Message ID. */
    this._id = TInt.nonNegative(id);

    /**
     * {*} Non-error result, if any. Always `null` if this is an error
     * response.
     */
    this._result = result;

    /**
     * {CodableError|null} Error response, or `null` if this instance doesn't
     * represent an error.
     */
    this._error = Response._fixError(error);

    /**
     * {array<string>|null} Error stack, or `null` if this instance doesn't
     * represent an error. In the case of an error that has no available stack
     * info, this is an empty array (`[]`) and not `null`.
     */
    this._errorStack = Response._fixErrorStack(error);

    Object.freeze(this);
  }

  /**
   * {CodableError|null} Error result, or `null` if this instance doesn't
   * represent an error.
   */
  get error() {
    return this._error;
  }

  /**
   * {array<string>|null} Clean error stack, or `null` if this instance doesn't
   * represent an error.
   */
  get errorStack() {
    return this._errorStack;
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
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._id, this._result, this._error];
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
    } else if (error instanceof Error) {
      // Adopt the message. Lose the rest of the info.
      return new CodableError(new Functor('general_error', error.message));
    }

    const message = (typeof error === 'string')
      ? error
      : inspect(error, { breakLength: Infinity });

    return new CodableError('general_error', message);
  }

  /**
   * Makes a cleaned-up stack from an incoming `error` argument. This returns
   * `null` if given `null`. In other cases were `error` doesn't come with a
   * stack, this returns an empty array.
   *
   * @param {*} error Error value.
   * @returns {array<string>|null} Cleaned up error stack as an array of stack
   *   lines. Will be `[]` if this is an error-ish value with no stack, or
   *   `null` if `error` is `null`.
   */
  static _fixErrorStack(error) {
    if (error === null) {
      return null;
    } else if (!(error instanceof Error)) {
      return [];
    }

    return ErrorUtil.stackLines(error);
  }
}
