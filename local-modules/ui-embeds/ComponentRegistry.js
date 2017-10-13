// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean, TFunction, TString } from 'typecheck';

import EmbeddableComponent from './components/EmbeddableComponent';

const COMPONENT_NAME_KEY = 'component-name-key';

export default class ComponentRegistry {
  constructor() {
    /**
     * {Map<string, EmbeddableComponent}>} Mapping of component
     * names to components.
     */
    this._registry = new Map();
  }

  static get componentNameKey() {
    return COMPONENT_NAME_KEY;
  }

  registerComponent(component, force = false) {
    TFunction.checkClass(component, EmbeddableComponent);
    TBoolean.check(force);

    const name = TString.nonEmpty(component.registryName);
    const entry = this._registry.get(name);

    if (entry && (force === false)) {
      throw new Error(`A component named '${name}' is already registered.`);
    }

    this._registry.set(name, component);
  }

  /**
   * Returns an entry from the component registry.
   *
   * @param {string} name The name of the componet to return.
   * @returns {EmbeddableComponent|undefined} The requested component.
   */
  componentForName(name) {
    TString.nonEmpty(name);

    return this._registry.get(name);
  }
}
