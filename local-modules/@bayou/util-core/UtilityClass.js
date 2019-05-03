// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors } from './Errors';

/**
 * Base class for "utility" classes. A utility class is one which is not
 * meant to be instantiated, but rather is merely a collection of `static`
 * methods. This (base) class enforces non-instantiability and also helps
 * serve as documentation for the intent of how a class is defined.
 *
 * @abstract
 */
export class UtilityClass {
  /**
   * Always throws an error. That is, utility classes are not ever supposed to
   * be instantiated.
   *
   * @throws {Errors.badUse} Always thrown.
   */
  constructor() {
    throw Errors.badUse('Attempt to instantiate utility class.');
  }
}
