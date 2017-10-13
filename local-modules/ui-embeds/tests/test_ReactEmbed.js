// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import PropTypes from 'prop-types';

import { EmbeddableComponent } from 'ui-embeds';

class TestComponent extends EmbeddableComponent {

}

TestComponent.embeddingPropTypes = {
  requiredString: PropTypes.string.isRequired,
  requiredNumber: PropTypes.number.isRequired,
  requiredBoolean: PropTypes.bool.isRequired,

  optionalString: PropTypes.string,
  optionalNumber: PropTypes.number,
  optionalBoolean: PropTypes.bool
};

describe('ui-embeds/EmbeddableComponent', () => {
  describe('EmbeddableComponent.assignPropertiesToElementAttributes()', () => {
    it('should throw if a required value is missing', () => {
      const props = {
        requiredString: 'string',
        requiredNumber: 1.0
      };

      const element = document.createElement('div'); // eslint-disable-line

      assert.throws(() => TestComponent.assignPropertiesToElementAttributes(props, element));
    });

    it('should not throw if all values are the correct type', () => {
      const props = {
        requiredString: 'me? i don\'t mean anything.',
        requiredNumber: 37.0,
        requiredBoolean: true
      };

      const element = document.createElement('div'); // eslint-disable-line

      assert.doesNotThrow(() => TestComponent.assignPropertiesToElementAttributes(props, element));
    });

    it('should throw if a value is the wrong type', () => {
      const props = {
        requiredString: 'string',
        requiredNumber: 1.0,
        requiredBoolean: 'this is not a boolean'
      };

      const element = document.createElement('div'); // eslint-disable-line

      assert.throws(() => TestComponent.assignPropertiesToElementAttributes(props, element));
    });

    it('should convert all defined props to DOM element attributes', () => {
      const props = {
        requiredString: 'string',
        requiredNumber: 1.0,
        requiredBoolean: true,
        optionalString: 'another string'
      };

      const element = document.createElement('div'); // eslint-disable-line

      TestComponent.assignPropertiesToElementAttributes(props, element);

      const stringAttribute = element.dataset.requiredString;
      const numberAttribute = element.dataset.requiredNumber;
      const booleanAttribute = element.dataset.requiredBoolean;
      const optionalStringAttribute = element.dataset.optionalString;

      assert.equal(stringAttribute, 'string');
      assert.equal(numberAttribute, '1');
      assert.equal(booleanAttribute, 'true');
      assert.equal(optionalStringAttribute, 'another string');
    });

    it('should extract properties from DOM element attributes', () => {
      const element = document.createElement('div'); // eslint-disable-line

      element.setAttribute('data-required-string', 'string');
      element.setAttribute('data-required-number', 37.0);
      element.setAttribute('data-required-boolean', true);
      element.setAttribute('data-optional-string', 'another string');

      const props = TestComponent.extractPropertiesFromElementAttributes(element);

      assert.equal(props.requiredString, 'string');
      assert.equal(props.requiredNumber, 37.0);
      assert.equal(props.requiredBoolean, true);
      assert.equal(props.optionalString, 'another string');
      assert.isNaN(props.optionalNumber);
    });
  });
});
