// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors, ObjectUtil } from '@bayou/util-core';

/**
 * Base class for singletons (classes for which there is ever but a single
 * instance). This class supports the mechanism by which a subclass's
 * constructor is only ever called once, and provides a consistently-named
 * property for accessing the singleton instance.
 *
 * Subclasses must define a no-argument constructor.
 *
 * JavaScript being prototype-based, it might be considered odd to bother
 * definining singletons per se. Nonetheless, the pattern can turn out to be
 * handy, particularly when it is necessary to defer instantiation until after
 * the system is running. (That is, it is often either incorrect or at least
 * inappropriate to initialize an effective-singleton at the time the class is
 * being `import`ed.)
 *
 * @abstract
 */
export class Singleton extends CommonBase {
  /**
   * {Singleton} The unique instance of this (derived) class. If the instance
   * has not yet been constructed, accessing this property causes construction
   * to take place.
   */
  static get theOne() {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon. We use `hasOwnProperty()` because it's possible to
    // subclass a singleton class, and we don't want to return a superclass
    // instance here.

    return ObjectUtil.hasOwnProperty(this, '_theOne')
      ? this._theOne
      : new this();
  }

  /**
   * Constructs an instance. This will throw an error if an instance of this
   * (derived) class already exists.
   */
  constructor() {
    super();

    // See the note in `theOne` above in re `hasOwnProperty`.
    if (ObjectUtil.hasOwnProperty(this.constructor, '_theOne')) {
      throw Errors.badUse('Attempt to re-instantiate singleton class.');
    }

    this.constructor._theOne = this;
  }
}
