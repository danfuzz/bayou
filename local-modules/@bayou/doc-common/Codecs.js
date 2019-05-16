// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Registry } from '@bayou/codec';
import { UtilityClass } from '@bayou/util-common';

import { BodyChange } from './BodyChange';
import { BodyDelta } from './BodyDelta';
import { BodyOp } from './BodyOp';
import { BodySnapshot } from './BodySnapshot';
import { Caret } from './Caret';
import { CaretChange } from './CaretChange';
import { CaretDelta } from './CaretDelta';
import { CaretOp } from './CaretOp';
import { CaretSnapshot } from './CaretSnapshot';
import { Property } from './Property';
import { PropertyChange } from './PropertyChange';
import { PropertyDelta } from './PropertyDelta';
import { PropertyOp } from './PropertyOp';
import { PropertySnapshot } from './PropertySnapshot';
import { SessionInfo } from './SessionInfo';

/**
 * Codec setup for this module.
 */
export class Codecs extends UtilityClass {
  /**
   * {string} Schema version string which uniquely identifies the structure of
   * documents and their constituent parts. Any time the formats change in an
   * way that is incompatible with pre-existing code, this value needs to be
   * changed, so that code can fail fast rather than silently corrupt documents.
   *
   * **Note:** The form of this string is `<year>-<seq>` where `<year>` is the
   * calendar year in which the format change was made, and `<seq>` is a
   * three-digit sequence number starting with `001`. (Three digits and not one
   * or two, so that it isn't mistaken for a month.)
   */
  static get SCHEMA_VERSION() {
    return '2018-004';
  }

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
    registry.registerClass(SessionInfo);
  }
}
