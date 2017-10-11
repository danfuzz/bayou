// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';
import React from 'react';
import ReactDOM from 'react-dom';
import { TBoolean, TFunction, TObject, TString } from 'typecheck';

const BlockEmbed = Quill.import('blots/block/embed');

const COMPONENT_NAME_KEY = 'component-name-key';

import EmbeddableComponent from './components/EmbeddableComponent';

/**
 * {Map<string, EmbeddableComponent>} Mapping of registry names to
 * components
 */
const registry = new Map();

export default class ReactEmbed extends BlockEmbed {
  static get componentNameKey() {
    return COMPONENT_NAME_KEY;
  }

  static registerComponent(component, force = false) {
    TFunction.checkClass(component, EmbeddableComponent);
    TBoolean.check(force);

    const name = TString.nonEmpty(component.registryName);
    const entry = registry.get(name);

    if (entry && (force === false)) {
      throw new Error(`A component named '${name}' is already registered.`);
    }

    registry.set(name, component);
  }

  /**
   * Returns an entry from the component registry.
   *
   * @param {string} name The name of the componet to return.
   * @returns {EmbeddableComponent} The requested component.
   */
  static componentForName(name) {
    TString.nonEmpty(name);

    return registry.get(name);
  }

  static assignComponentToValue(component, value) {
    TFunction.checkClass(component, EmbeddableComponent);
    TObject.plain(value);

    value[COMPONENT_NAME_KEY] = component.registryName;
  }

  constructor(domNode, value) {
    super(domNode, value);

    if ((COMPONENT_NAME_KEY in value) === false) {
      throw new Error('Component name missing from value');
    }

    const componentName = TString.nonEmpty(value[COMPONENT_NAME_KEY]);
    const component = ReactEmbed.componentForName(componentName);

    TFunction.checkClass(component, EmbeddableComponent);

    ReactDOM.render(
      React.createElement(component, value, null),
      domNode
    );
  }

  static create(value) {
    const node = super.create(value);
    const componentName = value[COMPONENT_NAME_KEY];
    const component = this.componentForName(componentName);

    component.assignPropertiesToElementAttributes(value, node);
    node.setAttribute(`data-${COMPONENT_NAME_KEY}`, componentName);

    return node;
  }

  static value(domNode) {
    const componentName = domNode.dataset[COMPONENT_NAME_KEY];
    const component = this.componentForName(componentName);
    const value = component.extractPropertiesFromElementAttributes(domNode);

    const result = Object.assign({}, value, { [COMPONENT_NAME_KEY]: componentName });

    return result;
  }
}

ReactEmbed.blotName = 'react-embed';
ReactEmbed.className = 'ql-react-embed';
ReactEmbed.tagName = 'div';
