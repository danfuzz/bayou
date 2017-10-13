// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { beforeEach, describe, it } from 'mocha';

import { ComponentRegistry, EmbeddableComponent } from 'ui-embeds';

class GoodComponent extends EmbeddableComponent {
  static get registryName() {
    return 'tests-good-component';
  }
}

class DuplicateNameComponent extends EmbeddableComponent {
  static get registryName() {
    return 'tests-good-component';
  }
}

class MissingNameComponent extends EmbeddableComponent {

}

let _registry;

describe('ui-embeds/ComponentRegistry', () => {
  beforeEach(() => {
    _registry = new ComponentRegistry();
  });

  describe('ComponentRegistry.registerComponent()', () => {
    it('should accept subclasses of `EmbeddableComponent`', () => {
      assert.doesNotThrow(() => _registry.registerComponent(GoodComponent));
    });

    it('should throw an Error if components with the same name are registered', () => {
      _registry.registerComponent(GoodComponent);

      assert.throws(() => _registry.registerComponent(DuplicateNameComponent));
    });

    it('should accept a duplicate name if the `force` flag is set', () => {
      _registry.registerComponent(GoodComponent);

      assert.doesNotThrow(() => _registry.registerComponent(DuplicateNameComponent, true));
    });

    it('should throw an Error if a component doesn\'t declare a name', () => {
      assert.throws(() => _registry.registerComponent(MissingNameComponent));
    });

    it('should return the last-registered component when the force flag is used', () => {
      _registry.registerComponent(GoodComponent);
      _registry.registerComponent(DuplicateNameComponent, true);

      const component = _registry.componentForName(GoodComponent.registryName);

      assert.equal(component, DuplicateNameComponent);
    });
  });

  describe('ComponentRegistry.componentForName()', () => {
    it('should return the correct component when registered by name', () => {
      _registry.registerComponent(GoodComponent);

      const component = _registry.componentForName(GoodComponent.registryName);

      assert.equal(component, GoodComponent);
    });

    it('should return null if an unregistered component is regquested', () => {
      assert.isUndefined(_registry.componentForName('lskdjflsjf;asjfl;jfl;wqejrlkew'));
    });
  });
});
