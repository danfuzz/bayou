// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';
import styles from './star.module.less';

export default class Star extends React.Component {
  render() {
    const classes = `${styles.star} ${styles.ts_icon_star_o}`;

    return <button className={ classes }></button>;
  }
}
