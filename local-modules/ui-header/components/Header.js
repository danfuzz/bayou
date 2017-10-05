// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

import Divider from './Divider';
import styles from './header.module.less';
import Owner from './Owner';
import SharingStatus from './SharingStatus';
import Star from './Star';
import Title from './Title';

export default class Header extends React.Component {
  render() {
    return (
      <div className={ styles.header }>
        <Title />
        <Star /><Divider /><Owner /><Divider /><SharingStatus />
      </div>
    );
  }
}
