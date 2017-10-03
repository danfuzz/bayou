// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

export default class Title extends React.Component {
  render() {
    return (
      <p style={{
        fontSize:     '1.125rem',
        fontWeight:   '900',
        margin:       0,
        color:        '#2c2d30',
        lineHeight:   '1.375rem',
        marginBottom: '2px'
      }}>
        Untitled
      </p>
    );
  }
}
