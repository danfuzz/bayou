import PropTypes from 'prop-types';
import Quill from 'quill';
import React from 'react';

import ComponentBlotWrapper from '../ComponentBlotWrapper';

/**
 * Absolute minimal React component to support embedding Figma
 * documents in Quill.
 */
export default class FigmaEmbed extends React.Component {
  /**
   * {string} The unique blot name for this embed type, as required
   * by `ComponentBlotWrapper`.
   */
  static get blotName() {
    return 'figma_embed';
  }

  /**
   * Determines if a given URL refers to a Figma document.
   *
   * @param {string} url The url to check.
   * @returns {boolean} True if the url refers to a Figma document.
   */
  static isFigmaUrl(url) {
    // Regex is from https://www.figma.com/platform
    const figma = /https:\/\/([w.-]+.)?figma.com\/(file|proto)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;

    return figma.test(url);
  }

  /**
   * Constructs the Rect props required for an instance of this
   * class.
   *
   * @param {string} url The url of the document to embed.
   * @returns {object} The initial props for an instance of this class.
   */
  static propsForUrl(url) {
    if (FigmaEmbed.isFigmaUrl(url)) {
      return { url };
    }

    return { url: '' };
  }

  /**
   * React method to produce the DOM elements for this component.
   *
   * @returns {HTMLElement} The elements for this component.
   */
  render() {
    const src = `https://www.figma.com/embed?embed_host=astra&url=${this.props.url}`;

    return (
      <iframe
        height="450"
        width="800"
        src={ src }
        allowFullScreen
      />
    );
  }
}

FigmaEmbed.propTypes = {
  // {string} The Figma URL to display in this embed.
  url: PropTypes.string.isRequired,
};

// Generates the Quill embedding wrapper class for this component and
// registers the wrapper with Quill.
Quill.register(ComponentBlotWrapper.blotWrapperForComponent(FigmaEmbed));
