// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Auth } from '@bayou/config-server';
import { ServerEnv } from '@bayou/env-server';
import { CommonBase } from '@bayou/util-common';

import Application from './Application';

/**
 * "Variable" info (like, it varies and isn't just static to the system), which
 * is provided via the internal monitoring server (see {@link Monitor}).
 *
 * **TODO:** The stuff collected and reported on here is highly-overlapping
 * with what is (or ought to be) reported via `/metrics`. Look into combining
 * these or at least moving as much as is sensible to {@link Metrics}.
 */
export default class VarInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Application} mainApplication The main application instance.
   */
  constructor(mainApplication) {
    super();

    /** {Application} The main application instance. */
    this._mainApplication = Application.check(mainApplication);

    Object.freeze(this);
  }

  /**
   * Gets the latest variable info.
   *
   * @returns {object} A JSON-encodable object with all of the variable info.
   */
  async get() {
    const app = this._mainApplication;

    const connections = { now: app.connectionCountNow, total: app.connectionCountTotal };
    const health      = await app.isHealthy();
    const mode        = this._currentMode();
    const rootTokens  = Auth.rootTokens.map(t => t.safeString);

    return { connections, health, mode, rootTokens };
  }

  /**
   * Gets the current "running mode." This is a short string indicative of
   * whether the system is starting up, actively running, or shutting down.
   *
   * @returns {string} The running mode.
   */
  _currentMode() {
    const shutdownManager = ServerEnv.theOne.shutdownManager;

    if (shutdownManager.shouldShutDown()) {
      return 'shuttingDown';
    }

    return this._mainApplication.isListening()
      ? 'running'
      : 'starting';
  }
}
