// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Registry } from 'codec';
import { UtilityClass } from 'util-common';

import Timestamp from './Timestamp';

/**
 * Utilities for this module.
 */
export default class TheModule extends UtilityClass {
  /**
   * Registers this module's encodable classes with a given codec registry.
   *
   * @param {Registry} registry Codec registry to register with.
   */
  static registerCodecs(registry) {
    Registry.check(registry);

    registry.registerClass(Timestamp);
  }
}
