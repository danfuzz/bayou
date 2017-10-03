// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

import Divider from './Divider';
import Owner from './Owner';
import SharingStatus from './SharingStatus';
import Star from './Star';
import Title from './Title';

export default class Header extends React.Component {
  render() {
    return (
      <div style={{
        marginLeft:    'rem',
        marginTop:     '0.5rem',
        paddingBottom: '0.5rem',
        borderWidth:   '0px 0px 1px 0px',
        borderColor:   '#e8e8e8',
        borderStyle:   'solid'
      }}>
        <Title />
        <Star /><Divider /><Owner /><Divider /><SharingStatus />
      </div>
    );
  }
}
