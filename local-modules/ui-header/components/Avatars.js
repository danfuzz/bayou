// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import styles from './avatar.module.less';
import { CaretState } from 'doc-client';

class Avatars extends React.Component {
  render() {
    return (
      <div className={ styles['document-header__avatars'] }>
        {
          [...this.props.sessions.entries()].map(([sessionId, caret]) => {
            return (
              <div key={ sessionId } className={ styles['document-header__avatar'] }>
                <img src='' />
                <div className={ styles['avatar-presence'] }
                  style={{ backgroundColor: caret.color }} />
              </div>
            );
          })
        }
      </div>
    );
  }
}

/**
 * Property type validator directives. Used as redux connect
 * maps the redux store state to this component's properties.
 */
Avatars.propTypes = {
  sessions: PropTypes.object.isRequired,
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
    sessions: CaretState.caretSnapshot(state)
  };
};

/**
 * Constructs a wrapper class that includes the redux connect binding.
 */
export default connect(mapStateToProps)(Avatars);
