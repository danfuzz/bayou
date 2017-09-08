// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import { TInt } from 'typecheck';
import { CommonBase, InfoError } from 'util-common';

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
      throw new Error('`result` and `error` cannot both be non-`null`.');
    }

    /** {Int} Message ID. */
    this._id = TInt.nonNegative(id);

    /**
     * {*} Non-error result, if any. Always `null` if this is an error
     * response.
     */
    this._result = result;

    /**
     * {InfoError|null} Error response, or `null` if this instance doesn't
     * represent an error.
     */
    this._error = Response._fixError(error);

    /**
     * {array<string>|null} Error stack, or `null` if unavailable (including if
     * this instance doesn't represent an error at all).
     */
    this._errorStack = Response._fixErrorStack(error);

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    // We intentionally strip the `error` down to just a message for encoding,
    // because the stack can leak security-sensitive info. **TODO:** We should
    // aim for a bit higher-fidelity transfer. E.g., with `InfoError`, it is
    // possible to encode the full error functor. This will probably best be
    // achieved by making a codec to handle `InfoError` (or perhaps an
    // API-specific subclass thereof.
    const error = (this._error === null) ? null : this._error.message;

    return [this._id, this._result, error];
  }

  /**
   * {InfoError|null} Error result, or `null` if this instance doesn't represent
   * an error.
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
   * Fixes up an incoming `error` argument. `null` gets returned as-is.
   * Everything else gets converted into an `InfoError` of some sort.
   *
   * @param {*} error Error value.
   * @returns {InfoError|null} Cleaned up error value.
   */
  static _fixError(error) {
    if (error === null) {
      return null;
    } else if (error instanceof InfoError) {
      return error;
    } else if (error instanceof Error) {
      return new InfoError(error, 'general_error', error.message);
    }

    const message = (typeof error === 'string')
      ? error
      : util.inspect(error);

    return new InfoError('general_error', message);
  }

  /**
   * Makes a cleaned-up stack from an incoming `error` argument. This returns
   * `null` if given `null`. In other cases were `error` doesn't come with a
   * stack, this returns an empty array.
   *
   * @param {*} error Error value.
   * @returns {string|null} Cleaned up error stack, `[]` if this is an error-ish
   *   value with no stack, or `null` if `error` is `null`.
   */
  static _fixErrorStack(error) {
    if (error === null) {
      return null;
    } else if (!(error instanceof Error)) {
      return [];
    }

    const stack = error.stack;

    if (typeof stack !== 'string') {
      return [];
    }

    // Match on each line of the stack that looks like a function/method call
    // (`...at...`). Using `map()` strip each one of the unintersting parts.
    return stack.match(/^ +at .*$/mg).map((line) => {
      // Lines that name functions are expected to be of the form
      // `    at func.name (/path/to/file:NN:NN)`, where `func.name` might
      // actually be `new func.name` or `func.name [as other.name]` (or both).
      let match = line.match(/^ +at ([^()]+) \(([^()]+)\)$/);
      let funcName;
      let filePath;

      if (match) {
        funcName = match[1];
        filePath = match[2];
      } else {
        // Anonymous functions (including top-level code) have the form
        // `    at /path/to/file:NN:NN`.
        match = line.match(/^ +at ([^()]*)$/);
        funcName = '(anon)';
        filePath = match[1];
      }

      const fileSplit = filePath.match(/\/?[^/]+/g) || ['?'];
      const splitLen  = fileSplit.length;
      const fileName  = (splitLen < 2)
        ? fileSplit[0]
        : `...${fileSplit[splitLen - 2]}${fileSplit[splitLen - 1]}`;

      return `${funcName} (${fileName})`;
    });
  }
}
