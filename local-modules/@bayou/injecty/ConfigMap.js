// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Map of names to injected configurations.
 */
export class ConfigMap extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {Map<string,*>} All injected configurations. */
    this._items = new Map();

    Object.freeze(this);
  }

  /**
   * Adds a new configured object or value. It is an error to call this with the
   * same name more than once.
   *
   * @param {string} name Name of the thing to inject. Must be an "identifier."
   * @param {*} value Value to associate with `name`.
   */
  add(name, value) {
    TString.identifier(name);

    if (this._items.has(name)) {
      throw Errors.badUse(`Name already configured: ${name}`);
    }

    this._items.set(name, value);
  }

  /**
   * Gets the previously-added configured object or value associated with the
   * given name. It is an error to pass a name which was not previously
   * configured via {@link #add}.
   *
   * @param {string} name Name of the previously-injected configuration.
   * @returns {*} Associated value or object.
   */
  get(name) {
    TString.identifier(name);

    const result = this._items.get(name);

    if ((result === undefined) && !this._items.has(name)) {
      throw Errors.badUse(`Name not configured: ${name}`);
    }

    return result;
  }
}
