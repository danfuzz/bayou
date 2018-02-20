// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import { DocumentState } from 'data-model-client';
import styles from './star.module.less';

/**
 * Star component for the page header. It indicates whether or
 * not this document is favorited.
 */
class Star extends React.Component {
  render() {
    const classes = this.props.isStarred
      ? `${styles.star} ${styles['star-enabled']} c-icon--star`
      : `${styles.star} ${styles['star-disabled']} c-icon--star-o`;

    return <button
      disabled={true}
      onClick={ this.props.onClick }
      className={ classes }>
    </button>;
  }
}

/**
 * Property type validator directives. Used as redux connect
 * maps the redux store state to this component's properties.
 */
Star.propTypes = {
  isStarred: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired
};

/**
 * Function to map global document state to just the
 * properties needed by this component.
 *
 * @param {object} state The redux state object to be mapped to Star props.
 * @returns {object} The Star props.
 */
const mapStateToProps = (state) => {
  return {
    isStarred: DocumentState.isStarred(state)
  };
};

/**
 * Function to map actions on the redux store to
 * properties needed by this component.
 *
 * @param {function} dispatch The redux store's `dispatch` function.
 * @returns {object} The redux actions allowed for this component.
 */
const mapDispatchToProps = (dispatch) => {
  return {
    onClick: () => {
      dispatch(DocumentState.toggleStarAction());
    }
  };
};

/**
 * Constructs a wrapper class that includes the redux connect binding.
 */
export default connect(mapStateToProps, mapDispatchToProps)(Star);
