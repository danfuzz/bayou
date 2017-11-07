// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import Quill from 'quill';
import React from 'react';

import ComponentBlotWrapper from '../ComponentBlotWrapper';

import styles from './image-embed.module.less';

const IMAGE_CLASSES = {
  left: {
    containerClass: styles.containerLeft,
    imageClass:     styles.imageLeft
  },

  right: {
    containerClass: styles.containerRight,
    imageClass:     styles.imageRight
  },

  center: {
    containerClass: styles.containerCenter,
    imageClass:     styles.imageCenter
  },

  // TODO: need to get some help sizing this correctly and getting text flowing
  //       past it.
  // full: {
  //   containerClass: styles.containerFull,
  //   imageClass:     styles.imageFull
  // },
};

/**
 * React component for handling images embedded. It contains the styling and
 * controls necessary to change between being left/center/right justified.
 * This component expects to be embedded in a Quill context by means of
 * `ui-embeds/ComponentBlotWrapper` and is not expeected to be easily
 * retargetable to other contexts (though it would actually work if its
 * property requirements are met).
 */
export default class ImageEmbed extends React.Component {
  /**
   * {string} The unique blot name for this embed type, as required
   * by `ComponentBlotWrapper`.
   */
  static get blotName() {
    return 'image_embed';
  }

  /**
   * Constructs an instance of this component as part of the React
   * lifecycle.
   *
   * @param {object} props A simple object holding the read-only
   *   properties for this instance.
   */
  constructor(props) {
    super(props);

    this.beginHover = this.beginHover.bind(this);
    this.endHover = this.endHover.bind(this);

    this.state = {
      inHover: false,
    };
  }

  /**
   * React lifecycle method indicating that the component was added
   * to the DOM. Normally we prepare the embedding container in
   * `componentWillUpdate()` but that isn't called for the initial render
   * so we're doing that work here.
   */
  componentDidMount() {
    this.prepareContainerForProps(this.props);
  }

  /**
   * React lifecycle method indicating that the props or state are about
   * to change. Right after this will be a call to `render()`. After we
   * rerender Quill will see the DOM change and grab the new set of
   * embed parameters from the DOM. So we use this hook to get those
   * new values into the DOM before Quill asks for them. We also
   * use it to fix up the CSS classes applied to the DIV we're rooted in.
   *
   * @param {object} nextProps The properties that will be active when
   *   the next call to `render()` happens.
   * @param {object} nextState_unused The local state object that will
   *   be active when the next call to `render()` happens.
   */
  componentWillUpdate(nextProps, nextState_unused) {
    this.prepareContainerForProps(nextProps);
    this.props.exportProps(nextProps);
  }

  /**
   * React lifecycle method indicating that our component is about to
   * be removed from the DOM. This is our last chance to push Finally
   * prop values out to Quill in case it needs them.
   */
  componentWillUnmount() {
    this.props.exportProps(this.props);
  }

  /**
   * Called when the cursor enters our component's bounds. Used to
   * update the local component state values and trigger a rerender.
   *
   * @param {MouseEvent} event_unused The mouse event.
   */
  beginHover(event_unused) {
    this.setState({ inHover: true });
  }

  /**
   * Called when the cursor exits our component's bounds. Used to
   * update the local component state values and trigger a rerender.
   *
   * @param {MouseEvent} event_unused The mouse event.
   */
  endHover(event_unused) {
    this.setState({ inHover: false });
  }

  /**
   * Returns the list of CSS classes to be applied to the image
   * within this component.
   *
   * @returns {string} The CSS classes.
   */
  imageClasses() {
    const classes = [styles.image];
    let alignment = this.props.alignment;

    if (!Object.keys(IMAGE_CLASSES).includes(alignment)) {
      alignment = 'center';
    }

    classes.push(IMAGE_CLASSES[alignment].imageClass);

    return classes.join(' ');
  }

  /**
   * Since embedded components are self-rooted there is no external
   * entity we can use to update the styling of the `DIV` that is
   * hosting us. This method uses hooks provided by the embedding
   * wrapper to let us update teh CSS classes on our containerClass
   * based on our properties.
   *
   * @param {object} props The properties to use for deciding what
   *   styling to apply to our wrapper `DIV`.
   */
  prepareContainerForProps(props) {
    for (const v of Object.values(IMAGE_CLASSES)) {
      this.props.removeClassFromContainer(v.containerClass);
    }

    this.props.addClassToContainer(IMAGE_CLASSES[props.alignment].containerClass);
  }

  /**
   * JSX to render out the image alignment toolbar.
   *
   * @returns {HTMLElement} The elements for the alignment buttons.
   */
  renderAlignmentToolbar() {
    return (
      <div className = { styles.alignmentContainer }>
        <button type = "button" onClick = { () => this.props.handleUpdate({ alignment: 'left' }) }>left</button>
        <button type = "button" onClick = { () => this.props.handleUpdate({ alignment: 'center' }) }>center</button>
        <button type = "button" onClick = { () => this.props.handleUpdate({ alignment: 'right' }) }>right</button>
        <button disabled type = "button" onClick = { () => this.props.handleUpdate({ alignment: 'full' }) }>full bleed</button>
      </div>
    );
  }

  /**
   * React lifecycle method to produce the DOM elements for this comonent.
   *
   * @returns {HTMLElement} The elements for this component.
   */
  render() {
    return (
      <div
        className = { styles.imageComplex }
        onMouseEnter = { this.beginHover }
        onMouseLeave = { this.endHover }>
        <img
          src = { this.props.url }
          className = { this.imageClasses() }
        />
        { this.state.inHover && this.renderAlignmentToolbar() }
      </div>
    );
  }
}

ImageEmbed.propTypes = {
  // {string} The image URL to display in this embed.
  url:            PropTypes.string.isRequired,

  // {string} One of [left | right | center | full]. We don't use a
  // proper `oneOf([])` proptype here because we need this field to
  // interop with the the embedding host machinery.
  alignment:      PropTypes.string,

  // {string} The caption (if any) to display under the image.
  caption:        PropTypes.string,

  // {function} A hook to call when this component needs its properties
  // updated by the embedding wrapper.
  handleUpdate:   PropTypes.func.isRequired,

  // {function} A hook to call when this component needs to ensure that
  // its current properties are copied to Quill.
  exportProps:    PropTypes.func.isRequired,

  // {function} A hook to call to add a CSS class to the `DIV` in which this
  // component is rooted.
  addClassToContainer:      PropTypes.func.isRequired,

  // {function} A hook to call to remove a CSS class from the `DIV` in which
  // this component is rooted.
  removeClassFromContainer: PropTypes.func.isRequired
};

ImageEmbed.defaultProps = {
  alignment:  'center'
};

// Generates the Quill embedding wrapper class for this component and
// registers the wrapper with Quill.
Quill.register(ComponentBlotWrapper.blotWrapperForComponent(ImageEmbed));
