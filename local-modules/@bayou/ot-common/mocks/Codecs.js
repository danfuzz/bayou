// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Registry } from '@bayou/codec';
import { UtilityClass } from '@bayou/util-common';

import { MockChange } from './MockChange';
import { MockDelta } from './MockDelta';
import { MockOp } from './MockOp';
import { MockSnapshot } from './MockSnapshot';

/**
 * Utilities for this module.
 */
export class Codecs extends UtilityClass {
  /**
   * Registers this module's encodable classes with a given codec registry.
   *
   * @param {Registry} registry Codec registry to register with.
   */
  static registerCodecs(registry) {
    Registry.check(registry);

    registry.registerClass(MockChange);
    registry.registerClass(MockDelta);
    registry.registerClass(MockOp);
    registry.registerClass(MockSnapshot);
  }
}
