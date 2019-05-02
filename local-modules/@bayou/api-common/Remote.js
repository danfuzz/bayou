// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from '@bayou/util-common';

import { TargetId } from './TargetId';

/**
 * Encodable representation of an object that is proxied over a connection.
 * Instances of this class are what get encoded instead of encoding a
 * {@link ProxiedObject} (or its target).
 */
export class Remote extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} targetId ID which represents the object, specifically with
   *   respect to the connection over which this instance is being used.
   */
  constructor(targetId) {
    super();

    /** {string} ID of the represented object. */
    this._targetId = TargetId.check(targetId);

    Object.freeze(this);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._targetId];
  }

  /** {string} ID of the represented object. */
  get targetId() {
    return this._targetId;
  }
}
