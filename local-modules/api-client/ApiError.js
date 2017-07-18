// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

/**
 * Error class for reporting errors coming from `ApiClient`. Differentiates
 * between connection/transport errors and application logic errors.
 *
 * **Note:** This class is defined to be a subclass of `Error` because instances
 * are most typically used as the rejection "reason" for promises, and rejection
 * reasons are generally expected to be instances of `Error`. That said, the
 * stack trace associated with these instances will almost never be useful, as
 * they will almost always get thrown most directly from API handler code.
 */
export default class ApiError extends Error {
  /** Constant indicating an application logic error. */
  static get APP() { return 'app'; }

  /** Constant indicating a connection / transport error. */
  static get CONN() { return 'conn'; }

  /**
   * Constructs an instance.
   *
   * @param {string} layer Which layer is the source of the problem. One of
   *   `CONN` (connection / transport) or `APP` (application, that is, the code
   *   on the far side of the connection).
   * @param {string} code Short error code, meant to be human-readable and
   *   machine-friendly. Must consist only of lowercase alphanumerics and the
   *   underscore, and be at least 5 and at most 40 characters total.
   * @param {string} [desc = 'API Error'] Longer-form human-readable
   *   error description.
   */
  constructor(layer, code, desc = 'API Error') {
    TString.check(layer);
    TString.check(code);
    TString.check(desc);

    if ((layer !== ApiError.APP) && (layer !== ApiError.CONN)) {
      throw new Error('Invalid value for `layer`.');
    }

    if (!/[a-z0-9_]{5,40}/.test(code)) {
      throw new Error('Invalid value for `code`.');
    }

    super(ApiError._fullMessage(layer, code, desc));

    /** The error layer. */
    this._layer = layer;

    /** The short error code. */
    this._code = code;

    /** The long-form error description. */
    this._desc = desc;
  }

  /**
   * Convenient wrapper for `new ApiError(ApiError.APP, ...)`.
   *
   * @param {...string} args Constructor arguments.
   * @returns {ApiError} The constructed error.
   */
  static appError(...args) {
    return new ApiError(ApiError.APP, ...args);
  }

  /**
   * Convenient wrapper for `new ApiError(ApiError.CONN, ...)`.
   *
   * @param {...string} args Constructor arguments.
   * @returns {ApiError} The constructed error.
   */
  static connError(...args) {
    return new ApiError(ApiError.CONN, ...args);
  }

  /**
   * The error layer. One of `ApiError.APP` or `ApiError.CONN`.
   */
  get layer() {
    return this._layer;
  }

  /**
   * The short human-readable and machine-friendly error code.
   */
  get code() {
    return this._code;
  }

  /**
   * The long-form human-readable description.
   */
  get desc() {
    return this._desc;
  }

  /**
   * Returns an indication of whether or not this instance is a
   * connection-related error.
   *
   * @returns {boolean} `true` iff this instance is a connection-related error.
   */
  isConnectionError() {
    return this._layer === 'CONN';
  }

  /**
   * Makes a full message string from the given parts.
   *
   * @param {string} layer String as defined by the constructor.
   * @param {string} code String as defined by the constructor.
   * @param {string} desc String as defined by the constructor.
   * @returns {string} Full message.
   */
  static _fullMessage(layer, code, desc) {
    return `[${layer} ${code}] ${desc}`;
  }
}
