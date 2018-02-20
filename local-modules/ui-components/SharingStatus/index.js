// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import { SharingState } from 'data-model-client';
import styles from './sharing-status.module.less';

/**
 * Sharing status component for the page header. It shows where
 * or with whom the document has been shared.
 */
class SharingStatus extends React.Component {
  render() {
    let statusString = null;

    switch (this.props.sharingStatus) {
      case SharingState.EVERYONE: {
        statusString = 'Visible to everyone in this workspace';
        break;
      }

      case SharingState.UNKNOWN: /* fallthrough */
      default: {
        statusString = 'Sharing status unknown';
        break;
      }
    }

    return (
      <p className={ styles.sharingStatus }>
        { statusString }
      </p>
    );
  }
}

/**
 * Property type validator directives. Used as redux connect
 * maps the redux store state to this component's properties.
 */
SharingStatus.propTypes = {
  sharingStatus: PropTypes.string.isRequired
};

/**
 * Function to map global document state to just the
 * properties needed by this component.
 *
 * @param {object} state The redux state object to be mapped
 *   to SharingStatus props.
 * @returns {object} The SharingStatus props.
 */
const mapStateToProps = (state) => {
  return {
    sharingStatus: SharingState.sharingState(state)
  };
};

/**
 * Constructs a wrapper class that includes the redux connect binding.
 */
export default connect(mapStateToProps)(SharingStatus);
