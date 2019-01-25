// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber } from '@bayou/ot-common';
import { Delay } from '@bayou/promise-util';
import { TInt, TObject } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import DocSession from './DocSession';

/**
 * How long to wait (in msec) after sending a caret update before sending the
 * next one.
 */
const UPDATE_DELAY_MSEC = 250;

/**
 * Handler for the upload of caret info from a client.
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

    /**
     * {boolean} Whether there is a caret update in progress. Starts out `true`
     * while the session proxy is getting set up (which is a lie, but one which
     * prevents failing server calls to be made), and then it is `false` in
     * steady state. It is set temporarily to `true` in `update()`.
     */
    this._updating = false;

    /**
     * {array|null} The latest caret update that was supplied, as an array of
     * arguments suitable for passing to `caret_update()`, for asynchronous
     * consumption. If `null`, indicates that there is no pending caret update.
     * This variable is set and reset in `update()`.
     */
    this._latestCaret = null;

    Object.seal(this);
  }

  /**
   * Updates the caret info for this session.
   *
   * @param {Int} docRevNum The document revision number for this info.
   * @param {object} range Range of the selection.
   */
  update(docRevNum, range) {
    RevisionNumber.check(docRevNum);
    TObject.check(range);
    TInt.nonNegative(range.index);
    TInt.nonNegative(range.length);

    this._latestCaret = [docRevNum, range.index, range.length];
    this._runUpdateLoop();
  }

  /**
   * Initiates the caret-update loop, if not already initiated. The loop runs
   * asynchronously, informing the server of the latest caret, and then waiting
   * a moment for further local updates before informing again. It exits once
   * updates have stopped coming in.
   */
  _runUpdateLoop() {
    if (this._updating) {
      // The loop below is already running; no need (and it would be
      // counterproductive) to run it again.
      return;
    }

    this._updating = true;

    // **TODO:** If anything in this `async` block throws, there's nothing to
    // catch the exception.
    (async () => {
      // We get this every time we run the method, because it's possible that
      // the proxy gets replaced during a reconnect.
      const sessionProxy = await this._docSession.getSessionProxy();

      for (;;) {
        const info = this._latestCaret;
        if (info === null) {
          break;
        }

        this._latestCaret = null;
        await Promise.all([
          sessionProxy.caret_update(...info),
          Delay.resolve(UPDATE_DELAY_MSEC)]);
      }

      this._updating = false;
    })();
  }
}
