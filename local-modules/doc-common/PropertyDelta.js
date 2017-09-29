// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TArray } from 'typecheck';
import { CommonBase, DataUtil } from 'util-common';

import PropertyOp from './PropertyOp';

/**
 * {PropertyDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Delta for property (document metadata) information, consisting of a simple
 * ordered list of operations. Instances of this class can be applied to
 * instances of `PropertySnapshot` to produce updated snapshots.
 *
 * Instances of this class are immutable.
 */
export default class PropertyDelta extends CommonBase {
  /** {PropertyDelta} Empty instance. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new PropertyDelta([]);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {array<object>} ops Array of individual property modification
   *   operations.
   */
  constructor(ops) {
    super();

    /**
     * {array<object>} Array of operations to perform on the (implied) base
     * `PropertySnapshot` to produce the new revision.
     */
    this._ops = Object.freeze(TArray.check(ops, PropertyOp.check));
  }

  /**
   * {array<PropertyOp>} Array of operations to be applied. This is guaranteed
   * to be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }

  /**
   * Compares this to another possible-instance, for equality. To be considered
   * equal, `other` must be an instance of this class with an `ops` which is
   * `DataUtil.equalData()` to this instance's `ops`.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` if `this` and `other` are equal, or `false` if
   *   not.
   */
  equals(other) {
    if (this === other) {
      return true;
    }

    return (other instanceof PropertyDelta)
      && DataUtil.equalData(this._ops, other._ops);
  }

  /**
   * Returns `true` iff this instance has the form of a "document," or put
   * another way, iff it is valid to compose with an empty snapshot. For this
   * class, to be considered a document `ops` must consist only of
   * `op_setProperty` instances, and no two ops may refer to the same property
   * name.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  isDocument() {
    const names = new Set();

    for (const op of this.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.SET_PROPERTY: {
          const sessionId = opProps.name;

          if (names.has(sessionId)) {
            return false;
          }

          names.add(sessionId);
          break;
        }

        default: {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._ops];
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    const name = this.constructor.name;
    const body = inspect(this._ops);

    return `${name} ${body}`;
  }
}
