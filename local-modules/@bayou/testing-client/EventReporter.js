// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseReporter } from '@bayou/testing-common';

/**
 * Mocha reporter, similar to its built-in "JSON stream" reporter, but
 * specifically tailored to emit exactly the right info for collection on our
 * server side. See {@link @bayou/testing-server.EventReceiver} for the
 * consuming code.
 */
export class EventReporter extends BaseReporter {
  /**
   * Constructs an instance.
   *
   * @param {mocha.Runner} runner The Mocha test driver.
   * @param {*} options Options as originally passed to the `Mocha` constructor.
   */
  constructor(runner, options) {
    super(runner, options);
  }

  /**
   * Handles an `allDone` event.
   */
  _impl_allDone() {
    this._emit('allDone');
  }

  /**
   * Handles a `suiteStart` event.
   *
   * @param {string} title The suite title.
   */
  _impl_suiteStart(title) {
    this._emit('suiteStart', title);
  }

  /**
   * Handles a `suiteEnd` event.
   */
  _impl_suiteEnd() {
    this._emit('suiteEnd');
  }

  /**
   * Handles a `testResult` event.
   *
   * @param {object} details Ad-hoc plain object with test details.
   */
  _impl_testResult(details) {
    this._emit('testResult', details);
  }

  /**
   * Emits an event for consumption by the ultimate test reporter, by writing
   * to the console. Each emitted event consists of an initial "sigil" of the
   * distinctive string `:::MOCHA:::` (to make it easy to parse out from other
   * console spew), followed by a JSON-encoded array consisting of a string
   * (event name), finally followed by zero or more event-specific arguments.
   *
   * @param {string} name Event name.
   * @param {...*} args Event-specific arguments.
   */
  _emit(name, ...args) {
    const event = [name, ...args];
    this._originalLog(':::MOCHA::: %s', JSON.stringify(event));
  }
}
