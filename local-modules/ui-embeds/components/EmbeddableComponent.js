// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

const STRING_CONVERTER = s => s;
const NUMBER_CONVERTER = s => Number.parseFloat(s);
const BOOLEAN_CONVERTER = s => s === 'true';

const TYPE_MAPPER = {
  [PropTypes.string.isRequired]: { isRequired: true, converter: STRING_CONVERTER },
  [PropTypes.number.isRequired]: { isRequired: true, converter: NUMBER_CONVERTER },
  [PropTypes.bool.isRequired]: { isRequired: true, converter: BOOLEAN_CONVERTER },

  [PropTypes.string]: { isRequired: false, converter: STRING_CONVERTER },
  [PropTypes.number]: { isRequired: false, converter: NUMBER_CONVERTER },
  [PropTypes.bool]: { isRequired: false, converter: BOOLEAN_CONVERTER }
};

/**
 * This is a subclass of React.Component and works in cooperation with
 * ReactEmbed to allow us to easily root a React component in a Quill
 * block embed. There are three things that have to be done to allow
 * an embeddable component to be used.
 *
 * 1. You must assign a unique name string for your component by
 *    overriding the getter `registryName()`.
 * 2. You must register the component by calling
 *    `ReactEmbed.registerComponent(MyEmbeddableComponentClass)`
 * 3. You must include the registry name in the embed values by
 *    calling
 *    `ReactEmbed.assignComponentToValue(MyEmbeddableComponentClass, value)`
 *
 * Usage is along the lines of:
 *
 * ```javascript
 * ReactEmbed.registerComponent(MyEmbeddableComponentClass);
 *
 * const value = {
 *   reactProp1: 'value 1',
 *   reactProp2: 'value 2'
 * };
 *
 * ReactEmbed.assignComponentToValue(MyEmbeddableComponentClass, value);
 *
 * quillInstance.insertEmbed(offset, ReactEmbed.blotName, value);
 * ```
 * This class provides a facility to automatically map React props to
 * DOM element `data-*` attributes. Any props referenced in the
 * class property `embeddingPropTypes` will be transferred to DOM
 * attributes when Quill flattens the embed to a Delta, and then transferred
 * back to component props when the component is recreated from that Delta.
 */
export default class EmbeddableComponent extends React.Component {
  /**
   * {string} The name to use when registering this component
   * with ReactEmbed.
   */
  static get registryName() {
    throw new Error('Must override');
  }

  /**
   * Takes the embedding properties defined by the component and assigns
   * them to `data-` attriubutes on the given DOM element so that Quill
   * can flatten the embed when making Deltas. This function will throw
   * an error if a required property is missing.
   *
   * @param {object} props The properties to be assigned.
   * @param {Element} element The DOM element to assign them to.
   */
  static assignPropertiesToElementAttributes(props, element) {
    const propTypes = this.embeddingPropTypes;

    for (const [prop, type] of Object.entries(propTypes)) {
      let isRequired = false;

      switch (type) {
        case PropTypes.string.isRequired:
        case PropTypes.number.isRequired:
        case PropTypes.bool.isRequired: {
          isRequired = true;
          break;
        }

        case PropTypes.string:
        case PropTypes.number:
        case PropTypes.bool: {
          // Keep these separate from the error case.
          break;
        }

        default: {
          throw new Error('Only string, number, and bool types are allowed for embedding');
        }
      }

      // If a required property is missing, it's an error.
      if (isRequired && ((prop in props) === false)) {
        throw new Error(`Required embedding property '${prop}' is missing`);
      }

      const value = props[prop];

      // If a required property is present but has no value, it is an error.
      if (isRequired && (value === null)) {
        throw new Error(`Required embedding property '${prop}' is missing`);
      }

      // convert "propertyName" to "data-property-name"
      const attributeName = `data-${_.kebabCase(prop)}`;

      // Finally, asign the property to the DOM element.
      element.setAttribute(attributeName, value);
    }
  }

  /**
   * Takes the `data-*` attributes of a given DOM element, compares them to
   * a PropTypes definition, and extracts all attributes with matching key
   * names. If a required property is missing an error will be thrown. If
   * an optional property is missing it will be assigned a value of
   * `null`.
   *
   * @param {Element} element The DOM element from which to extract properties.
   * @returns {object} The extracted properties as a frozen object.
   */
  static extractPropertiesFromElementAttributes(element) {
    const result = { };

    const propTypes = this.embeddingPropTypes;

    // For each interchange property figure out if it is required or not.
    // Also, since `data-*` attributes on DOM elements can only be strings
    // also figure out how which converter to use to go from a string to
    // the defined type.
    for (const [prop, type] of Object.entries(propTypes)) {
      const { isRequired, converter } = TYPE_MAPPER[type];

      if (isRequired === undefined) {
        throw new Error('Only string, number, and boolean proptery types are allowed');
      }

      const attributeName = `data-${_.kebabCase(prop)}`;
      let value = element.getAttribute(attributeName);

      // `getAttribute()` will return `null` if the key isn't defined.

      if (value) {
        // The property had a value defined for it.
        value = converter(value);
      } else if (isRequired) {
        // There wasn't a value and it was a required property.
        throw new Error(`Required embedding property '${prop}' is missing`);
      } else {
        // There was no value but it was an optional property.
        value = null;
      }

      result[prop] = value;
    }

    return Object.freeze(result);
  }
}

/**
 * {object<string, PropType>} Dictionary of the properties to be used
 * in the conversion of this React Component to/from a Quill BlockEmbed.
 * The properties listed here wil get converted to `data-*` attributes
 * when converting to a Quill DOM elements, and will be extracted from
 * same when going from a Quill Delta to a new Component.
 */
EmbeddableComponent.embeddingPropTypes = {
  // id: PropTypes.string.isRequired,
  // timestamp: PropTypes.number.isRequired,
  // imageUrl: PropTypes.string,
  // isHoopy: PropTypes.bool.isRequired
};
