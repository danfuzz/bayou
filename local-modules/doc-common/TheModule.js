// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Registry } from 'codec';
import { UtilityClass } from 'util-common';

import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';
import BodyOp from './BodyOp';
import BodySnapshot from './BodySnapshot';
import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import CaretSnapshot from './CaretSnapshot';
import Property from './Property';
import PropertyChange from './PropertyChange';
import PropertyDelta from './PropertyDelta';
import PropertyOp from './PropertyOp';
import PropertySnapshot from './PropertySnapshot';

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

    registry.registerClass(BodyChange);
    registry.registerClass(BodyDelta);
    registry.registerClass(BodyOp);
    registry.registerClass(BodySnapshot);
    registry.registerClass(Caret);
    registry.registerClass(CaretChange);
    registry.registerClass(CaretDelta);
    registry.registerClass(CaretOp);
    registry.registerClass(CaretSnapshot);
    registry.registerClass(Property);
    registry.registerClass(PropertyChange);
    registry.registerClass(PropertyDelta);
    registry.registerClass(PropertyOp);
    registry.registerClass(PropertySnapshot);
  }
}
