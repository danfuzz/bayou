// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import TargetId from './TargetId';

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
 * * The ID of the resource. **Note:** The ID is _not_ meant to require secrecy
 *   in order for the system to be secure. That is, IDs are not required to be
 *   unguessable.
 *
 * In addition, subclasses can include additional information.
 */
export default class BaseKey extends CommonBase {
  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} id Key / resource identifier. This must be a `TargetId`.
   */
  constructor(id) {
    super();

    /** {string} Key / resource identifier. */
    this._id = TargetId.check(id);
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * {string} Printable and security-safe (i.e. redacted if necessary) form of
   * the token. This will include an "ASCII ellipsis" (`...`) if needed, to
   * indicate redaction.
   */
  get safeString() {
    return TString.check(this._impl_safeString());
  }

  /**
   * Main implementation of {@link #safeString}. Subclasses must provide an
   * implementation of this.
   *
   * @abstract
   * @returns {string} The redacted string form of this instance.
   */
  _impl_safeString() {
    return this._mustOverride();
  }
}
