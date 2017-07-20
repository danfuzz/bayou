// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, PromDelay } from 'util-common';

import DocSession from './DocSession';

/**
 * How long to wait (in msec) after sending a caret update before sending the
 * next one.
 */
const UPDATE_DELAY_MSEC = 1000;

/**
 * Handler for the upload of caret info from this client.
 */
export default class CaretTracker extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {DocSession} docSession Session that this instance is tied to.
   */
  constructor(docSession) {
    super();

    /** {DocSession} Session that this instance is tied to. */
    this._docSession = DocSession.check(docSession);

    /** {Logger} Logger specific to the session. */
    this._log = docSession.log;

    /**
     * {Proxy|null} Proxy for the server-side session object. Becomes non-`null`
     * when the promise for same resolves, as arranged for in this constructor,
     * below.
     */
    this._sessionProxy = null;

    /**
     * {boolean} Whether to suppress updates. Starts out `true` while the
     * session proxy is getting set up, and then it is `false` in steady state.
     * It is set temporarily to `true` in `update()`.
     */
    this._suppress = true;

    // Arrange for `_sessionProxy` to get set.
    (async () => {
      this._sessionProxy = await docSession.makeSessionProxy();
      this._suppress = false;
      this._log.detail('Caret tracker got session proxy.');
    })();
  }

  /**
   * Updates the caret info for this session.
   *
   * @param {Int} docRevNum The document revision number for this info.
   * @param {object} range Range of the selection.
   */
  update(docRevNum, range) {
    if (this._suppress || (range === null)) {
      return;
    }

    // Inform the server, and then suppress further updates for the prescribed
    // amount of time.

    // **TODO:** If this call fails, there's nothing to catch the exception.
    this._sessionProxy.caretUpdate(docRevNum, range.index, range.length);

    this._suppress = true;

    (async () => {
      await PromDelay.resolve(UPDATE_DELAY_MSEC);
      this._suppress = false;
    })();
  }
}
