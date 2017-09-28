// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { Errors } from 'util-common';

import BaseSnapshot from './BaseSnapshot';
import PropertyChange from './PropertyChange';
import PropertyDelta from './PropertyDelta';
import PropertyOp from './PropertyOp';

/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 */
export default class PropertySnapshot extends BaseSnapshot {
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
     * form of an `op_setProperty`.
     */
    this._properties = new Map();

    // Fill in `_properties`.
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.SET_PROPERTY: {
          this._properties.set(opProps.name, op);
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
   * {Map<string, *>} Map from property names to values. Guaranteed to be
   * immutable.
   */
  get properties() {
    const result = new Map();

    for (const op of this._properties.values()) {
      const { name, value } = op.props;
      result.set(name, value);
    }

    Object.freeze(result);
    return result;
  }

  /**
   * Composes a change on top of this instance, to produce a new instance.
   *
   * @param {PropertyChange} change Change to compose on top of this instance.
   * @returns {PropertySnapshot} New instance consisting of the composition of
   *   this instance with `change`.
   */
  compose(change) {
    PropertyChange.check(change);

    const newProps = new Map(this._properties.entries());

    for (const op of change.delta.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case PropertyOp.SET_PROPERTY: {
          newProps.set(opProps.name, op);
          break;
        }

        case PropertyOp.DELETE_PROPERTY: {
          newProps.delete(opProps.name);
          break;
        }

        default: {
          throw Errors.wtf(`Weird op name: ${opProps.opName}`);
        }
      }
    }

    return new PropertySnapshot(change.revNum, [...newProps.values()]);
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a change which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerSnapshot ==
   * this.compose(this.diff(newerSnapshot))`.
   *
   * **Note:** The word `newer` in the argument name is meant to be suggestive
   * of typical usage of this method, but there is no actual requirement that
   * the argument be strictly newer in any sense, compared to the instance this
   * method is called on.
   *
   * @param {PropertySnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {PropertyChange} Change which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  diff(newerSnapshot) {
    PropertySnapshot.check(newerSnapshot);

    const newerProps = newerSnapshot._properties;
    const ops        = [];

    // Find properties that are new or updated from `this` when going to
    // `newerSnapshot`.
    for (const [name, op] of newerProps) {
      if (!op.equals(this._properties.get(name))) {
        // The newer snapshot has a property that is new or updated compared to
        // this one.
        ops.push(op);
      }
    }

    // Find properties removed from `this` when going to `newerSnapshot`.
    for (const name of this._properties.keys()) {
      if (!newerProps.get(name)) {
        ops.push(PropertyOp.op_deleteProperty(name));
      }
    }

    // Build the result.
    return new PropertyChange(newerSnapshot.revNum, ops);
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
   * Gets the property value for the given name, if any. Throws an error if
   * `name` is not a bound property.
   *
   * @param {string} name Property name.
   * @returns {*} Corresponding property value.
   */
  get(name) {
    TString.identifier(name);

    const p = this._properties.get(name);

    if (p) {
      return p.props.value;
    }

    throw Errors.bad_use(`No such property: ${name}`);
  }

  /**
   * Gets whether or not this instance has the indicated property.
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
    const op = PropertyOp.op_setProperty(name, value); // This type checks.

    return op.equals(this._properties.get(name))
      ? this
      : this.compose(new PropertyChange(this._revNum, [op]));
  }

  /**
   * Constructs an instance just like this one, except with a different
   * caret revision number. If the given revision number is the same as what
   * this instance already stores, this method returns `this`.
   *
   * @param {Int} revNum The new caret revision number.
   * @returns {PropertySnapshot} An appropriately-constructed instance.
   */
  withRevNum(revNum) {
    // This type checks `revNum`, which is why it's not just run when we need
    // to call `compose()`.
    const change = new PropertyChange(revNum, PropertyDelta.EMPTY);

    return (revNum === this.revNum) ? this : this.compose(change);
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
    const op = PropertyOp.op_deleteProperty(name); // This type checks.

    return this._properties.has(name)
      ? this.compose(new PropertyChange(this.revNum, [op]))
      : this;
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return PropertyChange;
  }
}
