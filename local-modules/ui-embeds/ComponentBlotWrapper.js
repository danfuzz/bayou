// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import _ from 'lodash';
import PropTypes from 'prop-types';
import Quill from 'quill';
import React from 'react';
import ReactDOM from 'react-dom';
import { TBoolean, TFunction, TNumber, TObject, TString } from 'typecheck';
import { Errors, UtilityClass } from 'util-core';

const BlockEmbed = Quill.import('blots/block/embed');

// When Properties are stored in DOM element attributes they can only be
// strings. When we extract those values back out they need to be
// converted back into the types defined in the PropTypes map for the
// React component. These functions perform those conversions.
const STRING_CONVERTER  = s => s;
const NUMBER_CONVERTER  = s => Number.parseFloat(s);
const BOOLEAN_CONVERTER = s => s === 'true';

const TYPE_MAPPER = new Map([
  [PropTypes.string.isRequired, {
    isRequired: true,
    converter: STRING_CONVERTER,
    validator: TString.check
  }],

  [PropTypes.number.isRequired, {
    isRequired: true,
    converter: NUMBER_CONVERTER,
    validator: TNumber.check
  }],

  [PropTypes.bool.isRequired, {
    isRequired: true,
    converter: BOOLEAN_CONVERTER,
    validator: TBoolean.check
  }],

  [PropTypes.string, {
    isRequired: false,
    converter: STRING_CONVERTER,
    validator: TString.check
  }],

  [PropTypes.number, {
    isRequired: false,
    converter: NUMBER_CONVERTER,
    validator: TNumber.check
  }],

  [PropTypes.bool, {
    isRequired: false,
    converter: BOOLEAN_CONVERTER,
    validator: TBoolean.check
  }]
]);

export default class BlockEmbedWrapper extends UtilityClass {
  /**
   * Generates a Quill blot wrapper for a React component. The returned class
   * can then be used to register the component with Quill.
   *
   * @param {React.Component} component The React component to be wrapped.
   * @param {string} [tagName = 'div'] The HTML element name for the
   *   outtermost wrapper object for these items.
   * @param {string} [className = 'ql-react-embed'] The initial CSS class
   *   name to be applied to these items when added to the DOM.
   * @returns {BlotWrapper} The component wrapper class.
   */
  static blotWrapperForComponent(component, tagName = 'div', className = 'ql-react-embed' ) {
    TFunction.checkClass(component, React.Component);

    const blotName = component.blotName;

    try {
      TString.nonEmpty(blotName);
    } catch (e) {
      throw Errors.badValue(component, 'React.Component', 'with `blotName`');
    }

    TString.nonEmpty(blotName);
    TString.nonEmpty(tagName);
    TString.nonEmpty(className);

    /**
     * The actual wrapper for the React component. This provides the minimal
     * interface needed to be a Quill blot.
     */
    class BlotWrapper extends BlockEmbed {
      /**
       * Constructor for the blot wrapper.
       *
       * @param {HTMLElement} domNode A DOM node of type `tagName` as defined
       *   above.
       * @param {object} value The `value` parameter that was passed to
       *   `quill.insertEmbed(blotName, value)`.
       */
      constructor(domNode, value) {
        super(domNode, value);

        TFunction.checkClass(component, React.Component);

        this._domNode = domNode;

        this._props = Object.assign({}, value, {
          addClassToContainer: this.addClassToContainer.bind(this),
          removeClassFromContainer: this.removeClassFromContainer.bind(this),
          handleUpdate: this.handleUpdate.bind(this),
          exportProps: this.exportProps.bind(this)
        });

        this._element = React.createElement(component, this._props, null);
        this.handleUpdate();
      }

      /**
       * Allocates the outer DOM element that contains this blot.
       * The result will be an `HTMLElement` of type `tagName` as
       * defined above. Any data that needs to persist with the element
       * should be transferred from the `value` argument to attributes
       * on the DOM element. This method is a required part of the blot
       * interface.
       *
       * @param {object} value The `value` parameter that was passed to
       *   `quill.insertEmbed(blotName, value)`.
       * @returns {BlockEmbed} The constructed instance.
       */
      static create(value) {
        const node = super.create(value);
        const propTypes = component.propTypes;

        this.assignPropertiesToElementAttributes(propTypes, value, node);

        return node;
      }

      /**
       * When a Quill document is flattened to a Delta various data about
       * each embed is stored with the embed reference. This method is
       * the bottleneck that allows you to pull data from the DOM
       * element for this blot and extract the data to be saved in the
       * Delta.
       *
       * @param {HTMLElement} domNode The outer DOM element representing an
       *   instance of this blot.
       * @returns {object} The data to be saved for this blot.
       */
      static value(domNode) {
        const propTypes = component.propTypes;

        return this.extractPropertiesFromElementAttributes(propTypes, domNode);
      }

      /**
       * Takes the embedding properties defined by the component and assigns
       * them to `data-*` attriubutes on the given DOM element.
       * This function will throw an error if a required property is missing.
       *
       * @param {object} [propTypes = {}] The property definition for
       *   this blot.
       * @param {object} props The property values to be assigned.
       * @param {Element} element The DOM element to assign them to.
       */
      static assignPropertiesToElementAttributes(propTypes = {}, props, element) {
        TObject.plain(propTypes);

        for (const [prop, type] of Object.entries(propTypes)) {
          const supportedType = TYPE_MAPPER.get(type);

          if (!supportedType) {
            continue;
          }

          const { validator } = supportedType;
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
              // Since we're using the component's full PropTypes as input we
              // can't put restrictions on the types of properties the component
              // has. So anything we don't know how to encode/decode will just
              // get skipped.
              continue;
            }
          }

          // If a required property is missing, it's an error.
          if (isRequired && ((prop in props) === false)) {
            throw Errors.badData(`'${prop}' is required`);
          }

          let value = props[prop];

          if (value === undefined) {
            // A property is missing or has no value, check to see if it was
            // required
            if (isRequired) {
              throw Errors.badData(`'${prop}' is required`);
            } else {
              continue;
            }
          }

          if (value === null) {
            // No need to encode null. We can infer that when we go the other
            // direction in `extractPropertiesFromElementAttributes`.
            continue;
          }

          // Check to make sure we got the type that we say we require.
          value = validator(value);

          // Convert "propertyName" to "data-property-name"
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
       * `undefined`.
       *
       * @param {PropTypes} [propTypes = {}] The property definitions for
       *   this blot.
       * @param {Element} element The DOM element from which to extract
       *   properties.
       * @returns {object} The extracted properties as a frozen object.
       */
      static extractPropertiesFromElementAttributes(propTypes = {}, element) {
        TObject.plain(propTypes);

        const result = {};

        // For each interchange property figure out if it is required or not.
        // Also, since `data-*` attributes on DOM elements can only be strings
        // also figure out how which converter to use to go from a string to
        // the defined type.
        for (const [prop, type] of Object.entries(propTypes)) {
          const supportedType = TYPE_MAPPER.get(type);

          if (!supportedType) {
            continue;
          }

          const { isRequired, converter, validator } = supportedType;

          const attributeName = `data-${_.kebabCase(prop)}`;
          let value = element.getAttribute(attributeName);

          // `getAttribute()` will return `null` if the key isn't defined.
          if (value === null) {
            if (isRequired) {
              // There wasn't a value and it was a required property.
              throw Errors.badData(`'${prop}' is required`);
            }
          } else {
            value = converter(value);
            value = validator(value);
          }

          result[prop] = value;
        }

        return Object.freeze(result);
      }

      /**
       * Allows an embedded component to set CSS classes on the `DIV` that
       * is wrapping it. Since each component is self-rooted in its own
       * little React world there is no other entity that can have
       * responsibiity for runtime styling of the container.
       *
       * @param {string} cssClass The class to add to the container.
       */
      addClassToContainer(cssClass) {
        TString.nonEmpty(cssClass);

        this._domNode.classList.add(cssClass);
      }

      /**
       * Allows an embedded component to remove CSS classes from the `DIV` that
       * is wrapping it. Since each component is self-rooted in its own
       * little React world there is no other entity that can have
       * responsibiity for runtime styling of the container.
       *
       * @param {string} cssClass The class to remove from the container.
       */
      removeClassFromContainer(cssClass) {
        this._domNode.classList.remove(cssClass);
      }

      /**
       * React components are not allows to modify their own props. But
       * since embedded components are self-rooted there is no other
       * entity that can pass down new props and cause a rerender. This
       * method is passed down to the wrapped component so that it can
       * trigger an update on its own.
       *
       * @param {object} propsToUpdate A plain object of key/value pairs.
       *   It will be used as an overlay on the existing props for the
       *   wrapped component as it is updated.
       */
      handleUpdate(propsToUpdate) {
        if (propsToUpdate) {
          propsToUpdate = TObject.plain(propsToUpdate);
          this._element = React.cloneElement(this._element, propsToUpdate);
        }

        ReactDOM.render(
          this._element,
          this._domNode
        );
      }

      /**
       * When Quill notices a change to the DOM it asks blots to report the
       * properties needed to recreate them later. Unfortunately the only
       * thing Quill gives us to work with is the outermost DOM element of
       * the blot. So we stash all of the embedded component's required
       * string/number/boolean properties in the element's `dataset` so
       * we can find it later.
       *
       * In an ideal world we'd be able to patch the component's
       * `componentWillUpdate()` method so that we could stash these values
       * automatically. But all the component elements created by React are
       * immutable. The best we can conveniently do is to pass this method
       * down to the component as part of its props so that it can signal
       * on its own that it needs to have its new props exported to Quill.
       *
       * @param {object} props A plain object of keys/values to push from
       *   the embedded React component to the `dataset` of the `DIV`
       *   hosting the component.
       */
      exportProps(props) {
        BlotWrapper.assignPropertiesToElementAttributes(component.propTypes, props, this._domNode);
      }

    }

    /** {string} The unique name for this blot, as required by Quill. */
    BlotWrapper.blotName = blotName;

    /**
     * {string} CSS class name, as required by Quill. This will be appied to
     * the outermost container element of the embed.
     */
    BlotWrapper.className = className;

    /**
     * {string} DOM element name (e.g. 'div'), as required by Quill. This
     * element acts as the outermost container of the embd.
     */
    BlotWrapper.tagName = tagName;

    return BlotWrapper;
  }
}
