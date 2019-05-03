// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Singleton } from '@bayou/util-common';

import { ConfigMap } from './ConfigMap';

/**
 * Module-internal singleton class which holds the system-wide instance of
 * {@link ConfigMap}.
 */
export class AllConfigs extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {ConfigMap} The configurations. */
    this.map = new ConfigMap();

    Object.freeze(this);
  }
}
