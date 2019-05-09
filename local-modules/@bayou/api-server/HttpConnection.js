// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ObjectUtil } from '@bayou/util-common';

import { BaseConnection } from './BaseConnection';

/**
 * Partial implementation of {@link BaseConnection}, for all connections that
 * use HTTP transport including a usual "request" object.
 */
export class HttpConnection extends BaseConnection {
  /**
   * Constructs an instance.
   *
   * @param {object} req The HTTP request.
   * @param {ContextInfo} contextInfo Construction info for the {@link Context}
   *   to use.
   */
  constructor(req, contextInfo) {
    super(contextInfo);

    /** {object} The HTTP request. */
    this._req = req;
  }

  /**
   * Implementation of method as required by the superclass.
   *
   * @param {string} name Name of the cookie in question.
   * @returns {string|null} Cookie value, or `null` if there is no cookie with
   *   the given `name`.
   */
  _impl_getCookie(name) {
    return HttpConnection._getWhatever(this._req.cookies, name);
  }

  /**
   * Implementation of method as required by the superclass.
   *
   * @param {string} name Name of the header in question.
   * @returns {string|null} Header value, or `null` if there is no header with
   *   the given `name`.
   */
  _impl_getHeader(name) {
    return HttpConnection._getWhatever(this._req.headers, name);
  }

  /**
   * Helper for the two thing-getters, which both bottom out in equivalent
   * look-ups, just on different properties.
   *
   * @param {object|undefined|null} obj Map-like object to look a name up in,
   *   or `null`(ish) if there's no object in question.
   * @param {string} name Name to look up.
   * @returns {string|null} Value found in `obj`, or `null` if either `obj`
   *   is `null`(ish) or it doesn't contain `name`.
   */
  static _getWhatever(obj, name) {
    if (!(obj && ObjectUtil.hasOwnProperty(obj, name))) {
      return null;
    }

    return obj[name];
  }
}
