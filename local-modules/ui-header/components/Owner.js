// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import styles from './owner.module.less';

/**
 * Owner component for the page header. It shows the name of the user who
 * owns this document (creator of the file).
 */
class Owner extends React.Component {
  render() {
    return (
      <p className={ styles.owner }>
        { this.props.ownerName }
      </p>
    );
  }
}

/**
 * Property type validator directives. Used as redux connect
 * maps the redux store state to this component's properties.
 */
Owner.propTypes = {
  ownerName: PropTypes.string.isRequired
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
    ownerName: state.owner.name
  };
};

/**
 * Constracuts a wrapper class that includes the redux connect binding.
 */
export default connect(mapStateToProps)(Owner);
