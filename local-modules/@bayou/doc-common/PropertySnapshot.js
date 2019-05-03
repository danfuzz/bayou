// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';
import { TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import { PropertyChange } from './PropertyChange';
import { PropertyDelta } from './PropertyDelta';
import { PropertyOp } from './PropertyOp';

/**
 * Snapshot of information about all the properties of a particular document.
 * Instances of this class are always frozen (immutable).
 *
 * When thought of in terms of a map, instances of this class can be taken to
 * be maps from string keys to arbitrary data values.
 */
export class PropertySnapshot extends BaseSnapshot {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information.
   * @param {PropertyDelta|array<PropertyOp>} contents A from-empty delta (or
   *   array of ops which can be used to construct same), representing all the
   *   properties to include in the instance.
   */
  constructor(revNum, contents) {
    super(revNum, contents);

    /**
     * {Map<string, PropertyOp>} Map of name to corresponding property, in the
     * form of an `op_set`.
     */
    this._properties = new Map();

    // Fill in `_properties`.
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.CODE_set: {
          this._properties.set(opProps.property.name, op);
          break;
        }

        default: {
          // Should have been prevented by the `isDocument()` check.
          throw Errors.wtf('Weird op');
        }
      }
    }

    Object.freeze(this._properties);
    Object.freeze(this);
  }

  /**
   * {Int} The number of properties defined by this instance.
   *
   * **Note:** This has identical semantics to the `Map` property of the same
   * name.
   */
  get size() {
    return this.contents.ops.length;
  }

  /**
   * Gets an iterator over the `[name, property]` entries that make up the
   * snapshot.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name.
   *
   * @yields {[string, *]} Snapshot entries. The keys are the property names,
   *   and the values are the corresponding property values.
   */
  * entries() {
    for (const op of this.contents.ops) {
      const property = op.props.property;
      yield [property.name, property];
    }
  }

  /**
   * Compares this to another possible-instance, for equality of content.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof PropertySnapshot)) {
      return false;
    }

    const thisProps  = this._properties;
    const otherProps = other._properties;

    if (   (this.revNum    !== other.revNum)
        || (thisProps.size !== otherProps.size)) {
      return false;
    }

    for (const [name, op] of thisProps) {
      if (!op.equals(otherProps.get(name))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets the property for the given name, if any. Throws an error if `name` is
   * not a bound property.
   *
   * **Note:** This differs from the semantics of the `Map` method of the same
   * name in that the not-found case is an error.
   *
   * @param {string} name Property name.
   * @returns {Property} Corresponding property.
   */
  get(name) {
    const found = this.getOrNull(name);

    if (found) {
      return found;
    }

    throw Errors.badUse(`No such property: ${name}`);
  }

  /**
   * Gets the property for the given name, if any.
   *
   * @param {string} name Property name.
   * @returns {Property|null} Corresponding property, or `null` if there is
   *   none.
   */
  getOrNull(name) {
    TString.identifier(name);

    const found = this._properties.get(name);

    return found ? found.props.property : null;
  }

  /**
   * Gets whether or not this instance has the indicated property.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name, except that it will reject `name`s of the wrong type.
   *
   * @param {string} name Property name.
   * @returns {boolean} `true` if this instance has a binding for the indicated
   *   property, or `false` if not.
   */
  has(name) {
    TString.identifier(name);
    return this._properties.has(name);
  }

  /**
   * Constructs an instance just like this one, except with an additional or
   * updated property binding. If the given property (same name and value) is
   * already represented in this instance, this method returns `this`.
   *
   * @param {string} name Name of the property being set. Must be an
   *   "identifier" string.
   * @param {*} value Value of the property. Must be a pure data value.
   * @returns {PropertySnapshot} An appropriately-constructed instance.
   */
  withProperty(name, value) {
    const op = PropertyOp.op_set(name, value); // This type checks.

    return op.equals(this._properties.get(name))
      ? this
      : this.compose(new PropertyChange(this._revNum, [op]));
  }

  /**
   * Constructs an instance just like this one, except without the named
   * property. If this instance does not have the named property, then this
   * method returns `this`.
   *
   * @param {string} name Name of the property to remove. Must be an
   *   "identifier" string.
   * @returns {PropertySnapshot} An appropriately-constructed instance.
   */
  withoutProperty(name) {
    const op = PropertyOp.op_delete(name); // This type checks.

    return this._properties.has(name)
      ? this.compose(new PropertyChange(this.revNum, [op]))
      : this;
  }

  /**
   * Main implementation of {@link #diff}, which produces a delta (not a
   * change).
   *
   * @param {PropertySnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {PropertyDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  _impl_diffAsDelta(newerSnapshot) {
    const newerProps = newerSnapshot._properties;
    const resultOps  = [];

    // Find properties that are new or updated from `this` when going to
    // `newerSnapshot`.
    for (const [name, op] of newerProps) {
      if (!op.equals(this._properties.get(name))) {
        // The newer snapshot has a property that is new or updated compared to
        // this one.
        resultOps.push(op);
      }
    }

    // Find properties removed from `this` when going to `newerSnapshot`.
    for (const name of this._properties.keys()) {
      if (!newerProps.get(name)) {
        resultOps.push(PropertyOp.op_delete(name));
      }
    }

    // Build the result.
    return new PropertyDelta(resultOps);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {PropertyChange} change The change to be validated in the context of
   *   `this`.
   * @throws {Error} Thrown if `change` is not valid to compose with `this`.
   */
  _impl_validateChange() {
    // **TODO:** Implement this!
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return PropertyChange;
  }
}
