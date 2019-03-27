// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Condition, Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TObject } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import BootInfo from './BootInfo';
import Dirs from './Dirs';

/**
 * {Int} How long (in msec) to wait between iterations in the shutdown-file
 * polling loop.
 */
const SHUTDOWN_POLL_DELAY_MSEC = 60 * 1000; // One minute.

/**
 * {Int} How long (in msec) to wait during shutdown to allow the shutdown
 * promise list to be populated.
 */
const SHUTDOWN_PROMISE_POPULATION_DELAY_MSEC = 500; // Half a second.

/**
 * {Int} The maximum amount of time (in msec) that should be spent waiting for
 * shutdown promises before giving up and just exiting.
 */
const MAX_SHUTDOWN_TIME_MSEC = 60 * 1000; // One minute.

/** {Logger} Logger for this class. */
const log = new Logger('control');

/**
 * System shutown manager. This includes handling shutdown requests that are
 * presented in the `control` directory, along with the mechanism which other
 * parts of the system can use to notice when shutdown is happening and have a
 * chance to exit cleanly.
 */
export default class ShutdownManager extends CommonBase {
  /**
   * Constructs an instance. Logging aside, this doesn't cause any external
   * action to take place (i.e. reacting to the control files); that stuff
   * happens in {@link #init}.
   *
   * @param {BootInfo} bootInfo Associated boot info manager.
   */
  constructor(bootInfo) {
    super();

    const CONTROL_PATH = Dirs.theOne.CONTROL_DIR;

    /** {BootInfo} Associated boot info manager. */
    this._bootInfo = BootInfo.check(bootInfo);

    /** {string} Path for the shutdown-command file. */
    this._shutdownPath = path.resolve(CONTROL_PATH, 'shutdown');

    /** {string} Path for the stopped-indicator file. */
    this._stoppedPath = path.resolve(CONTROL_PATH, 'stopped');

    /**
     * {Condition} Condition which becomes `true` when the server should be
     * shutting down.
     */
    this._shutdownCondition = new Condition();

    /**
     * {array<Promise>} Promises representing the completion of tasks that
     * should be done before the system exits.
     */
    this._shutdownPromises = [];

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
   * Indicates that the given promise should get resolved before the system
   * exits.
   *
   * @param {Promise} promise Promise that the system should wait for before
   * exiting.
   */
  waitFor(promise) {
    TObject.check(promise, Promise);
    this._shutdownPromises.push(promise);
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

    // If we receive SIGHUP, immediately check for the shutdown file.
    process.on('SIGHUP', this._checkForShutdownRequest.bind(this));

    // Loop forever, waiting/polling for the shutdown file to exist, and/or for
    // the shutdown condition to be flipped by other means (notably, the signal
    // handler which got setup just above here).
    (async () => {
      const shutdownTrue = this._shutdownCondition.whenTrue();

      while (!this._shutdownCondition.value) {
        await Promise.race([
          Delay.resolve(SHUTDOWN_POLL_DELAY_MSEC),
          shutdownTrue]);

        this._checkForShutdownRequest();
      }

      this._doShutdown();
    })();
  }

  /**
   * Performs a check for a shutdown request. If so requested, flip the
   * {@link #_shutdownCondition} to `true`.
   */
  _checkForShutdownRequest() {
    if (this._shutdownCondition.value) {
      // Shutdown has already been requested. No need to check again.
      return;
    }

    log.event.checkingForShutdownRequest();

    if (fs.existsSync(this._shutdownPath)) {
      this._shutdownCondition.value = true;
      log.event.shutdownRequested();
    }
  }

  /**
   * Perform all of the shutdown actions, and then exit the process.
   */
  async _doShutdown() {
    log.event.shuttingDown();

    // Arrange for the `stopped` file to get written during process exit.
    process.once('exit', () => this._writeStoppedFile());

    // Wait for all the registered shutdown promises, including ones that get
    // added while waiting for earlier-registered ones. But stop after the
    // overall timeout. That is, give things a reasonable amount of time to
    // shutdown cleanly, but pull the plug if things just drag on too long.

    const timeoutPromise = Delay.resolve(MAX_SHUTDOWN_TIME_MSEC);
    let   timedOut       = false;
    const promises       = this._shutdownPromises;

    (async () => {
      await timeoutPromise;
      timedOut = true;
    })();

    while (!timedOut) {
      if (promises.length === 0) {
        // When there's nothing (apparently) left to do, give the system just a
        // moment more in case just-resolved promises (or similar) trigger the
        // addition of new shutdown promises. This notably allows the original
        // `await`ers of the `_shutdownCondition` time to register their
        // promises.
        await Delay.resolve(SHUTDOWN_PROMISE_POPULATION_DELAY_MSEC);

        if (promises.length === 0) {
          // Nothing more added, so we're done!
          break;
        }
      }

      const currentLength      = promises.length;
      const allCurrentPromises = Promise.all(promises.slice(0));
      promises.splice(0, currentLength); // Clear it out; ready for new ones.

      log.event.awaitingShutdownPromises(currentLength);
      await Promise.race([allCurrentPromises, timeoutPromise]);
    }

    if (timedOut) {
      log.event.shutdownTimedOut();
    }

    const bootInfo = this._bootInfo;

    bootInfo.incrementShutdownCount();
    const { bootCount, buildId, shutdownCount, uptimeMsec } = bootInfo;
    log.metric.shutdown({ buildId, uptimeMsec, bootCount, shutdownCount, timedOut });

    log.event.shutdownComplete();
    process.exit(0);
  }

  /**
   * Writes the `stopped` indicator file.
   */
  _writeStoppedFile() {
    fs.writeFileSync(this._stoppedPath, 'stopped\n');
  }
}
