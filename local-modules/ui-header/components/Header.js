// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

import Avatars from './Avatars';
import Divider from './Divider';
import headerStyles from './header.module.less';
import Owner from './Owner';
import SharingStatus from './SharingStatus';
import Star from './Star';
import Title from './Title';

export default class Header extends React.Component {
  render() {
    return (
      // Overall header container
      <div className={ headerStyles['document-header'] }>
        { /* Lefthand side of the header with document me */ }
        <div className={ headerStyles['document-header__meta'] }>
          <Title />
          <div className={ headerStyles['document-header__info'] }>
            <Star /><Divider /><Owner /><Divider /><SharingStatus />
          </div>
        </div>
        { /* Righthand side of the header with session info */ }
        <div className={ headerStyles['document-header__collaboration'] }>
          <Avatars />
        </div>
      </div>
    );
  }
}
