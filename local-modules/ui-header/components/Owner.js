// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';

import styles from './owner.module.less';

export default class Owner extends React.Component {
  render() {
    return (
      <p className={ styles.owner }>
        Some Lovely Team Member
      </p>
    );
  }
}
