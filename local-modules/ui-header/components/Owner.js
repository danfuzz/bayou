// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

export default class Owner extends React.Component {
  render() {
    return (
      <p style={{
        display:    'inline-block',
        margin:     0,
        fontWeight: '100',
        fontSize:   '0.8125rem',
        color:      '#2c2d30',
        lineHeight: '1rem',
        userSelect: 'none',
        '-webkit-user-select': 'none',
        '-moz-user-select':    'none',
        '-ms-user-select':     'none'
      }}>
        Some Lovely Team Member
      </p>
    );
  }
}
