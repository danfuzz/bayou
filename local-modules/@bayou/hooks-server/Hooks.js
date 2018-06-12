// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Singleton } from '@bayou/util-common';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();
  }

  /**
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after logging has
   * been initialized but before almost everything else.
   */
  async run() {
    // This space intentionally left blank.
  }
}
