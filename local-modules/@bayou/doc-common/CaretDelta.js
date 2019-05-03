// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import { CaretOp } from './CaretOp';

/**
 * Delta for caret information, consisting of a simple ordered list of
 * operations. Instances of this class can be applied to instances of `Caret`
 * and `CaretSnapshot` to produce updated instances of those classes.
 *
 * **Note:** To be valid as a document delta, the set of operations must (a)
 * only consist of `add` ops, and (b) not mention any given caret ID more than
 * once.
 *
 * Instances of this class are immutable.
 */
export class CaretDelta extends BaseDelta {
  /**
   * Main implementation of {@link #compose}.
   *
   * @param {CaretDelta} other Delta to compose with this instance.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {CaretDelta} Composed result.
   */
  _impl_compose(other, wantDocument) {
    // Map from each caret to an array of ops which apply to it.
    const carets = new Map();

    // Add / replace the ops, first from `this` and then from `other`, as a
    // mapping from the caret ID.
    for (const op of [...this.ops, ...other.ops]) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.CODE_add: {
          // Clear out the caret except for this op, because no earlier op could
          // possibly affect the result.
          carets.set(opProps.caret.id, [op]);
          break;
        }

        case CaretOp.CODE_delete: {
          if (wantDocument) {
            // Document deltas don't remember caret deletions.
            carets.delete(opProps.caretId);
          } else {
            // Clear out the caret; same reason as `add` above. We _do_ keep the
            // op, because the fact of a deletion needs to be part of the final
            // composed result.
            carets.set(opProps.caretId, [op]);
          }
          break;
        }

        case CaretOp.CODE_setField: {
          const caretId = opProps.caretId;
          const ops     = carets.get(caretId);
          let   handled = false;

          if (!ops) {
            // This is a "naked" set (no corresponding `add` in the result).
            // Just start off an array with it.
            carets.set(caretId, [op]);
            handled = true;
          } else if (ops.length === 1) {
            // We have a single-element array for this caret. It might be a
            // `add` or an `delete`, in which case we can do something special.
            const op0Props = ops[0].props;
            if (op0Props.opName === CaretOp.CODE_add) {
              // Integrate the new value into the caret.
              const caret = op0Props.caret.compose(new CaretDelta([op]));
              ops[0] = CaretOp.op_add(caret);
              handled = true;
            } else if (op0Props.opName === CaretOp.CODE_delete) {
              // We ignore set-after-end. A bit philosophical, but what does
              // it even mean to set a value on a nonexistent thing?
              handled = true;
            }
          }

          // If not handled by the special cases above, try to find an op to
          // replace in the existing array (same field). If not found, append
          // the op.
          for (let i = 0; !handled && (i < ops.length); i++) {
            if (ops[i].props.key === opProps.key) {
              ops[i] = op;
              handled = true;
            }
          }

          if (!handled) {
            ops.push(op);
          }

          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }

    const allOps = [].concat(...carets.values());
    return new CaretDelta(allOps);
  }

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
        case CaretOp.CODE_add: {
          const caretId = opProps.caret.id;

          if (ids.has(caretId)) {
            return false;
          }

          ids.add(caretId);
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
    return CaretOp;
  }
}
