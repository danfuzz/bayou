// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Condition, Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

import Dirs from './Dirs';

/**
 * {Int} How long (in msec) to wait between iterations in the shutdown-file
 * polling loop.
 */
const SHUTDOWN_POLL_DELAY_MSEC = 60 * 1000; // One minute.

/** {Logger} Logger for this class. */
const log = new Logger('control');

/**
 * Manager for the `control` directory, including writing / erasing the PID file
 * and heeding shutdown requests issued by virtue of the presence of a
 * signalling file.
 */
export default class ProcessControl extends CommonBase {
  /**
   * Constructs an instance. Logging aside, this doesn't cause any external
   * action to take place (such as writing the PID file); that stuff happens in
   * {@link #init}.
   */
  constructor() {
    super();

    const CONTROL_PATH = Dirs.theOne.CONTROL_DIR;

    /** {string} Path for the shutdown-command file. */
    this._shutdownPath = path.resolve(CONTROL_PATH, 'shutdown');

    /** {string} Path for the stopped-indicator file. */
    this._stoppedPath = path.resolve(CONTROL_PATH, 'stopped');

    /**
     * {Condition} Condition which becomes `true` when the server should be
     * shutting down.
     */
    this._shutdownCondition = new Condition();

    Object.freeze(this);
  }

  /**
   * Returns an instantaneous indicator of whether or not the system should be
   * shutting down (or not running in the first place).
   *
   * @returns {boolean} `true` if the system should be shutting down, or `false`
   *   if it should be running as normal.
   */
  shouldShutDown() {
    return this._shutdownCondition.value;
  }

  /**
   * Returns a promise that becomes `true` when the control files indicate that
   * the server should shut down.
   *
   * @returns {Promise<boolean>} Promise that resolves to `true` per above.
   */
  whenShuttingDown() {
    return this._shutdownCondition.whenTrue();
  }

  /**
   * Initializes the control-file handlers, including dealing with the
   * possibility that the server is getting started up in a state where the
   * control files indicate it shouldn't be running.
   */
  init() {
    // If the `shutdown` or `stopped` files exist, then this server shouldn't
    // start up in the first place.
    if (fs.existsSync(this._stoppedPath)) {
      log.event.alreadyStopped();
      this._shutdownCondition.value = true;
    } else if (fs.existsSync(this._shutdownPath)) {
      // Write the `stopped` file to acknowledge to the world that the server
      // got the request to shut down. (If we don't do this, the controlling
      // environment might mistakenly believe the server still needs to run.)
      this._writeStoppedFile();
      log.event.alreadyShuttingDown();
      this._shutdownCondition.value = true;
    }

    if (this._shutdownCondition.value) {
      // We already know we're shutting down, so don't bother with the polling.
      return;
    }

    // Loop forever, waiting/polling for the shutdown file to exist, and
    // reacting to that by flipping `_shutdownCondition` to `true`.
    (async () => {
      for (;;) {
        await Delay.resolve(SHUTDOWN_POLL_DELAY_MSEC);

        log.event.checkingForShutdownRequest();

        if (fs.existsSync(this._shutdownPath)) {
          break;
        }
      }

      this._shutdownCondition.value = true;
      log.event.shutdownRequested();

      // Arrange for the `stopped` file to get written during process exit.
      process.once('exit', () => this._writeStoppedFile());
    })();
  }

  /**
   * Writes the `stopped` indicator file.
   */
  _writeStoppedFile() {
    fs.writeFileSync(this._stoppedPath, 'stopped\n');
  }
}
