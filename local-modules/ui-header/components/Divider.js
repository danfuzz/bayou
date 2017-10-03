// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

export default class Divider extends React.Component {
  render() {
    return (
      <span style={{
        marginLeft:  '0.5rem',
        marginRight: '0.5rem',
        color:       '#a0a0a2',
        userSelect:  'none',
        '-webkit-user-select': 'none',
        '-moz-user-select':    'none',
        '-ms-user-select':     'none'
      }}>
        |
      </span>
    );
  }
}
