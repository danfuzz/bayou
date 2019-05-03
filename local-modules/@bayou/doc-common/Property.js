// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { CommonBase, DataUtil } from '@bayou/util-common';

/**
 * Pair consisting of a string name and an arbitrary data value representing a
 * single property within a `PropertySnapshot`. Instances of this class are
 * always frozen (immutable).
 */
export class Property extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} name Name of the property. Must be in "identifier" syntax.
   * @param {*} value Value associated with `name`. Must be a data value.
   */
  constructor(name, value) {
    super();

    /** {string} Property name. */
    this._name = TString.identifier(name);

    /** {*} Property value. */
    this._value = DataUtil.deepFreeze(value);

    Object.freeze(this);
  }

  /** {string} Property name. */
  get name() {
    return this._name;
  }

  /** {*} Property value. Always a deep-frozen data value. */
  get value() {
    return this._value;
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._name, this._value];
  }

  /**
   * Compares this to another value, for equality.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof Property)) {
      return false;
    }

    return (this._name === other._name)
      && DataUtil.equalData(this._value, other._value);
  }
}
