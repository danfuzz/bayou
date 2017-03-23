// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Base class which provides a couple conveniences beyond what baseline
 * JavaScript has.
 */
export default class CommonBase {
  /**
   * Helper function which always throws an error with the message `Must
   * override.`. Using this both documents the intent in code and keeps the
   * linter from complaining about the documentation (`@param`, `@returns`,
   * etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
