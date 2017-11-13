// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import Quill from 'quill';
import React from 'react';

import ComponentBlotWrapper from '../ComponentBlotWrapper';

import styles from './image-embed.module.less';

/* {object} Convenience wrapper for some very long CSS class names */
const IMAGE_CLASSES = {
  left: {
    containerClass: styles['p-image-embed-container--left-justified'],
    imageClass:     styles['p-image-embed__image--left-justified']
  },

  right: {
    containerClass: styles['p-image-embed-container--right-justified'],
    imageClass:     styles['p-image-embed__image--right-justified']
  },

  center: {
    containerClass: styles['p-image-embed-container--center-justified'],
    imageClass:     styles['p-image-embed__image--center-justified']
  },

  // TODO: need to get some help sizing this correctly and getting text flowing
  //       past it.
  // full: {
  //   containerClass: styles['p-image-embed-container--full-bleed'],
  //   imageClass:     styles['p-image-embed__image--full-bleed']
  // },
};

/**
 * React component for handling image embeds. It contains the styling and
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

    this.beginEditingCaption = this.beginEditingCaption.bind(this);
    this.cancelCaptionEditing = this.cancelCaptionEditing.bind(this);
    this.handleCaptionChange = this.handleCaptionChange.bind(this);

    this.state = {
      inHover:        false,
      editingCaption: false
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
   * React lifecycle method indicating that the component properties
   * are about to change.
   *
   * @param {object} nextProps The new properties that are about to
   *   take effect.
   */
  componentWillReceiveProps(nextProps) {
    this.setState({
      hasCaption: this.hasCaption(nextProps)
    });
  }

  /**
   * React lifecycle method indicating that the props or state are about
   * to change. This will be followed by a call to `render()`. After we
   * re-render, Quill will see the DOM change and grab the new set of
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
   * be removed from the DOM. This is our last chance to push final
   * prop values out to Quill.
   */
  componentWillUnmount() {
    this.props.exportProps(this.props);
  }

  /**
   * Called when the cursor enters our component's bounds. Used to
   * update the local component state values and trigger a re-render.
   *
   * @param {MouseEvent} event_unused The mouse event.
   */
  beginHover(event_unused) {
    this.setState({ inHover: true });
  }

  /**
   * Called when the cursor exits our component's bounds. Used to
   * update the local component state values and trigger a re-render.
   *
   * @param {MouseEvent} event_unused The mouse event.
   */
  endHover(event_unused) {
    this.setState({ inHover: false });
  }

  /**
   * Returns whether or not the props contain a displayable caption.
   *
   * @param {object} props The properties to query.
   * @returns {boolean} Whether there is a caption or not.
   */
  hasCaption(props) {
    return props.caption && (typeof props.caption === 'string') && (props.caption.length > 0);
  }

  /**
   * Called when the user focuses on an existing caption or on the
   * 'add a caption' CTA box.
   */
  beginEditingCaption() {
    this.setState({ editingCaption: true });
  }

  /**
   * Called when caption editing has ended -- either from the user hitting
   * return or moving the focus out of the caption editor.
   *
   * @param {FocusEvent|KeyboardEvent} event The event that triggered the end of
   *   caption editing session.
   */
  handleCaptionChange(event) {
    const caption = event.target.value;

    this.setState({ editingCaption: false });
    this.props.handleUpdate({ caption });
  }

  /**
   * Called when the user hits ESC or otherwise causes the editing of the image
   * caption to be canceled.
   *
   * @param {KeyboardEvent} event_unused The event that triggered the canceling
   *   of the editing session.
   */
  cancelCaptionEditing(event_unused) {
    this.setState({ editingCaption: false });
  }

  /**
   * Returns the list of CSS classes to be applied to the image
   * within this component.
   *
   * @returns {string} The CSS classes.
   */
  imageClasses() {
    const classes = [styles['p-image-embed__image']];
    let alignment = this.props.alignment;

    // Quick sanity check to make sure the alignment is one
    // we actually support.
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
   * wrapper to let us update the CSS classes on our container
   * based on our properties.
   *
   * @param {object} props The properties to use for deciding what
   *   styling to apply to our wrapper `DIV`.
   */
  prepareContainerForProps(props) {
    // Remove all of the alignment classes
    for (const v of Object.values(IMAGE_CLASSES)) {
      this.props.removeClassFromContainer(v.containerClass);
    }

    // Add just the one we want
    this.props.addClassToContainer(IMAGE_CLASSES[props.alignment].containerClass);
  }

  /**
   * Produces JSX for the image alignment toolbar.
   *
   * @returns {HTMLElement} The elements for the alignment buttons.
   */
  renderAlignmentToolbar() {
    // This whole thing is a placeholder until we can incorporate the `popover`
    // and `tooltip` components that we need for the proper toolbar.
    return (
      <div className = { styles['p-image-embed__alignment-container'] }>
        <button type="button" onClick={ () => this.props.handleUpdate({ alignment: 'left' }) }>left</button>
        <button type="button" onClick={ () => this.props.handleUpdate({ alignment: 'center' }) }>center</button>
        <button type="button" onClick={ () => this.props.handleUpdate({ alignment: 'right' }) }>right</button>
        <button disabled type="button" onClick = { () => this.props.handleUpdate({ alignment: 'full' }) }>full bleed</button>
      </div>
    );
  }

  /**
   * Produces JSX for the image caption, or the editor for the caption.
   *
   * @returns {HTMLElement} The elements for the caption.
   */
  renderCaption() {
    const captionStyles = [styles['p-image-embed__caption']];

    if (this.state.editingCaption) {
      captionStyles.push(styles['p-image-embed__caption-input']);

      // The `<input>`-based editor is a placeholder. This will eventually
      // be a whole other QuillProm instance with support for emoji, etc.
      // and our handlers for return/esc. The onBlur handler is for if
      // the user clicks outside the editor.
      return (
        <input
          type = 'text'
          autoFocus
          className={ captionStyles.join(' ') }
          maxLength='140'
          defaultValue={ this.props.caption || '' }
          onBlur={ this.handleCaptionChange }
          onKeyUp={
            (event) => {
              const char = event.keyCode || event.which;

              if (char === 13) { // return key
                this.handleCaptionChange(event);
                return false;
              } else if (char === 27) { // ESC key
                this.cancelCaptionEditing(event);
                return false;
              }

              return true;
            }
          } />
      );
    }

    // If we're not editing then we're either showing a caption, or
    // displaying the CTA to add one.
    let text = this.props.caption;

    if (this.state.inHover) {
      if (!this.hasCaption(this.props)) {
        text = 'Write a caption';
        captionStyles.push(styles['p-image-embed__caption--CTA']);
      }
    } else {
      captionStyles.push(styles['p-image-embed__caption--static']);
    }

    return (
      <p
        className={ captionStyles.join(' ')}
        onClick={ this.beginEditingCaption }
      >
        { text }
      </p>
    );
  }

  /**
   * React method to produce the DOM elements for this component.
   *
   * @returns {HTMLElement} The elements for this component.
   */
  render() {
    return (
      <div
        className={ styles['p-image-embed__image-editing-container'] }
        onMouseEnter={ this.beginHover }
        onMouseLeave={ this.endHover }
      >
        <img
          src={ this.props.url }
          className={ this.imageClasses() }
        />
        { this.state.inHover && this.renderAlignmentToolbar() }
        { this.renderCaption() }
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
