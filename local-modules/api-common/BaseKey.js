// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

/**
 * Base class for access keys. An access key consists of information for
 * accessing a network-accessible resource, along with functionality for
 * performing authentication. In general, a given instance of this class
 * represents access to a particular resource, but that same resource might also
 * be available via different instances of the class too, and even using
 * different IDs. (That is, it can be a many-to-one relationship.)
 *
 * Instances of this (base) class hold two pieces of information:
 *
 * * A URL at which the resource is available.
 * * The ID of the resource.
 *
 * In addition, subclasses can include additional information.
 *
 * **Note:** The resource ID is _not_ meant to require secrecy in order for
 * the system to be secure. That is, IDs are not required to be unguessable.
 */
export default class BaseKey {
  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint.
   * @param {string} id Key / resource identifier. This must be a string of 16
   *   hex digits (lower case).
   */
  constructor(url, id) {
    /** {string} URL at which the resource may be accessed. */
    this._url = TString.urlAbsolute(url);

    /** {string} Key / resource identifier. */
    this._id = TString.hexBytes(id, 8, 8);
  }

  /** {string} URL at which the resource may be accessed. */
  get url() {
    return this._url;
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * Gets the redacted form of this instance.
   *
   * @returns {string} The redacted form.
   */
  toString() {
    return `{${this.constructor.API_NAME} ${this._url} ${this._id}}`;
  }
}
