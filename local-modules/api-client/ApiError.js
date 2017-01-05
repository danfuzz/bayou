// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Error class for reporting errors coming from `ApiClient`. Differentiates
 * between connection/transport errors and application logic errors.
 *
 * **Note:** This is _not_ a subclass of `Error` because all that would provide
 * is a stack trace, and in fact the stack trace isn't useful by the time you
 * have an instance of this class (because you will have gotten it from a
 * promise via `then()` or similar).
 */
export default class ApiError {
  /** Constant indicating an application logic error. */
  static get APP() { return 'app'; }

  /** Constant indicating a connection / transport error. */
  static get CONN() { return 'conn'; }

  /**
   * Constructs an instance.
   *
   * @param layer Which layer is the source of the problem. One of `CONN`
   *   (connection / transport) or `APP` (application, that is, the code on the
   *   far side of the connection).
   * @param code Short error code, meant to be human-readable and
   *   machine-friendly. Must consist only of lowercase alphanumerics and the
   *   underscore, and be at least 5 and at most 40 characters total.
   * @param desc (optional; default 'API Error') Longer-form human-readable
   *   error description.
   */
  constructor(layer, code, desc = 'API Error') {
    if ((layer !== ApiError.APP) && (layer !== ApiError.CONN)) {
      throw new Error('Invalid value for `layer`.');
    }

    if (!/[a-z0-9_]{5,40}/.test(code)) {
      throw new Error('Invalid value for `code`.');
    }

    /** The error layer. */
    this._layer = layer;

    /** The short error code. */
    this._code = code;

    /** The long-form error description. */
    this._desc = desc;
  }

  /**
   * Convenient wrapper for `new ApiError(ApiError.APP, ...)`.
   */
  static appError(...args) {
    return new ApiError(ApiError.APP, ...args);
  }

  /**
   * Convenient wrapper for `new ApiError(ApiError.CONN, ...)`.
   */
  static connError(...args) {
    return new ApiError(ApiError.CONN, ...args);
  }

  /**
   * Gets the unified string form of this instance.
   */
  toString() {
    return `[${this._layer} ${this._code}] ${this._desc}`;
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
}
