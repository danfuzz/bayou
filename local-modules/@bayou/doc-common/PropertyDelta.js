// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import { PropertyOp } from './PropertyOp';

/**
 * Delta for property (document metadata) information, consisting of a simple
 * ordered list of operations. Instances of this class can be applied to
 * instances of `PropertySnapshot` to produce updated snapshots.
 *
 * **Note:** To be valid as a document delta, the set of operations must (a)
 * not have any deletes, and (b) not mention any given property name more than
 * once.
 *
 * Instances of this class are immutable.
 */
export class PropertyDelta extends BaseDelta {
  /**
   * Main implementation of {@link #compose}.
   *
   * @param {PropertyDelta} other Delta to compose with this instance.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {PropertyDelta} Composed result.
   */
  _impl_compose(other, wantDocument) {
    const props = new Map();

    // Add / replace the ops, first from `this` and then from `other`, as a
    // mapping from the property name. Note that we need to remember properties
    // that are deleted (by `this` or `other`), so that the deletion is part of
    // the result delta.
    for (const op of [...this.ops, ...other.ops]) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.CODE_delete: {
          if (wantDocument) {
            // Document deltas don't remember property deletions; they simply
            // don't have the property in question.
            props.delete(opProps.name);
          } else {
            // For non-document results, we need to remember properties that are
            // deleted (by `this` or `other`), so that the deletion is part of
            // the result delta.
            props.set(opProps.name, op);
          }
          break;
        }

        case PropertyOp.CODE_set: {
          props.set(opProps.property.name, op);
          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }

    return new PropertyDelta([...props.values()]);
  }

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
        case PropertyOp.CODE_set: {
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
