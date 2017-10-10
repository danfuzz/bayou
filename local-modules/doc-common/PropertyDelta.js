// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseDelta from './BaseDelta';
import PropertyOp from './PropertyOp';

/**
 * Delta for property (document metadata) information, consisting of a simple
 * ordered list of operations. Instances of this class can be applied to
 * instances of `PropertySnapshot` to produce updated snapshots.
 *
 * Instances of this class are immutable.
 */
export default class PropertyDelta extends BaseDelta {
  /**
   * Main implementation of {@link #isDocument}.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    const names = new Set();

    for (const op of this.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.SET_PROPERTY: {
          const name = opProps.property.name;

          if (names.has(name)) {
            return false;
          }

          names.add(name);
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
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return PropertyOp;
  }
}
