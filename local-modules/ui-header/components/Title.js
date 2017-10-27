// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentState } from 'data-model-client';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import styles from './title.module.less';

class Title extends React.Component {
  render() {
    return (
      <p className={ styles.title }>
        { this.props.title }
      </p>
    );
  }
}

/**
 * Property type validator directives. Used as redux connect
 * maps the redux store state to this component's properties.
 */
Title.propTypes = {
  title: PropTypes.string.isRequired
};

/**
 * Function to map global document state to just the
 * properties needed by this component.
 *
 * @param {object} state The redux state object to be mapped to Owner props.
 * @returns {object} The Owner props.
 */
const mapStateToProps = (state) => {
  return {
    title: DocumentState.title(state)
  };
};

/**
 * Constructs a wrapper class that includes the redux connect binding.
 */
export default connect(mapStateToProps)(Title);
