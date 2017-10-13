// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';
import React from 'react';
import ReactDOM from 'react-dom';
import { TFunction, TObject, TString } from 'typecheck';

const BlockEmbed = Quill.import('blots/block/embed');

import ComponentRegistry from './ComponentRegistry';
import EmbeddableComponent from './components/EmbeddableComponent';

/** {ComponentRegistry} Mapping of registry names to components */
const _registry = new ComponentRegistry();

export default class ReactEmbed extends BlockEmbed {
  static registerComponent(component, force = false) {
    _registry.registerComponent(component, force);
  }

  /**
   * Returns an entry from the component registry.
   *
   * @param {string} name The name of the componet to return.
   * @returns {EmbeddableComponent} The requested component.
   */
  static componentForName(name) {
    return _registry.componentForName(name);
  }
  static assignComponentToValue(component, value) {
    TFunction.checkClass(component, EmbeddableComponent);
    TObject.plain(value);

    value[ComponentRegistry.componentNameKey] = component.registryName;
  }

  constructor(domNode, value) {
    super(domNode, value);

    if ((ComponentRegistry.componentNameKey in value) === false) {
      throw new Error('Component name missing from value');
    }

    const componentName = TString.nonEmpty(value[ComponentRegistry.componentNameKey]);
    const component = ReactEmbed.componentForName(componentName);

    TFunction.checkClass(component, EmbeddableComponent);

    ReactDOM.render(
      React.createElement(component, value, null),
      domNode
    );
  }

  static create(value) {
    const node = super.create(value);
    const componentName = value[ComponentRegistry.componentNameKey];
    const component = this.componentForName(componentName);

    component.assignPropertiesToElementAttributes(value, node);
    node.setAttribute(`data-${ComponentRegistry.componentNameKey}`, componentName);

    return node;
  }

  static value(domNode) {
    const componentName = domNode.dataset[ComponentRegistry.componentNameKey];
    const component = this.componentForName(componentName);
    const value = component.extractPropertiesFromElementAttributes(domNode);

    const result = Object.assign({}, value, { [ComponentRegistry.componentNameKey]: componentName });

    return result;
  }
}

ReactEmbed.blotName = 'react-embed';
ReactEmbed.className = 'ql-react-embed';
ReactEmbed.tagName = 'div';
