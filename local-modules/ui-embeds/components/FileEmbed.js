// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import Quill from 'quill';
import React from 'react';
import { Units } from 'util-common';

import ComponentBlotWrapper from '../ComponentBlotWrapper';

import styles from './file-embed.module.less';

/**
 * A minimal component to represent a file embedded in a document.
 * It does not upload the file to anywhere. It's currently here
 * merely to let us interact with the designs.
 */
export default class FileEmbed extends React.Component {
  /**
   * {string} The unique blot name for this embed type, as required
   * by `ComponentBlotWrapper`.
   */
  static get blotName() {
    return 'file_embed';
  }

  constructor(props) {
    super(props);

    this.beginHover = this.beginHover.bind(this);
    this.endHover = this.endHover.bind(this);

    this.state = {
      inHover: false
    };
  }

  beginHover() {
    this.setState({ inHover: true });
  }

  endHover() {
    this.setState({ inHover: false });
  }

  render() {
    return (
      <div className = { styles.container } onMouseEnter = { this.beginHover } onMouseLeave = { this.endHover } >
        <div className = { styles.iconContainer }>
          <p className={`c-icon--file_generic ${styles.icon}`}></p>
          { this.state.inHover && <button className = { `${styles.downloadButton} c-icon--cloud_download` }></button> }
        </div>
        <div className = { styles.metadataContainer }>
          <p className = { styles.filename }>{ this.props.filename }</p>
          <p className = { styles.size }>{ Units.filesizeToString(this.props.sizeInBytes, 1) }</p>
        </div>
      </div>
    );
  }
}

FileEmbed.propTypes = {
  filename:    PropTypes.string.isRequired,
  sizeInBytes: PropTypes.number,
  mimetype:    PropTypes.string
};

Quill.register(ComponentBlotWrapper.blotWrapperForComponent(FileEmbed));
