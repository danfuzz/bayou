// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseDelta from './BaseDelta';
import CaretOp from './CaretOp';

/**
 * Delta for caret information, consisting of a simple ordered list of
 * operations. Instances of this class can be applied to instances of `Caret`
 * and `CaretSnapshot` to produce updated instances of those classes.
 *
 * Instances of this class are immutable.
 */
export default class CaretDelta extends BaseDelta {
  /**
   * Main implementation of {@link #isDocument}.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    const ids = new Set();

    for (const op of this.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.BEGIN_SESSION: {
          const sessionId = opProps.caret.sessionId;

          if (ids.has(sessionId)) {
            return false;
          }

          ids.add(sessionId);
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
  static get _impl_opClassOrPredicate() {
    return CaretOp;
  }
}
