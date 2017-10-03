// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

export default class Star extends React.Component {
  render() {
    return (
      <button style={{
        fontFamily:      'icon-font',
        fontWeight:      'normal',
        fontSize:        '0.8125rem',
        color:           '#717274',
        width:           '1rem',
        padding:         0,
        height:          '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        border:          'none'
      }}>
        &#57345;
      </button>
    );
  }
}
