// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import is_running from 'is-running';
import http from 'http';

import { Network } from '@bayou/config-server';
import { Logger } from '@bayou/see-all';
import { Errors, Singleton } from '@bayou/util-common';

import BootInfo from './BootInfo';
import Dirs from './Dirs';
import PidFile from './PidFile';
import BuildInfo from './BuildInfo';
import ShutdownManager from './ShutdownManager';

/** {Logger} Logger. */
const log = new Logger('env-server');

/**
 * Miscellaneous server-side utilities.
 */
export default class ServerEnv extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    // Make sure that the directories could be determined, before proceeding any
    // further.
    Dirs.theOne;

    /** {BootInfo} Info about the booting of this server. */
    this._bootInfo = new BootInfo();

    /** {BuildInfo} Info about the build. */
    this._buildInfo = new BuildInfo();

    /** {PidFile} The PID file manager. */
    this._pidFile = new PidFile();

    /** {ShutdownManager} The shutdown manager. */
    this._shutdownManager = new ShutdownManager();

    Object.freeze(this);
  }

  /**
   * {object} Ad-hoc object with generally-useful info about the booting of this
   * server, intended for logging / debugging.
   *
   * **Note:** This isn't all-caps `*_INFO` because it's not necessarily
   * expected to be a constant value.
   */
  get bootInfo() {
    return this._bootInfo.info;
  }

  /**
   * {object} Ad-hoc object with metainformation about the build (that is, about
   * the product artifact), intended for logging / debugging.
   *
   * **Note:** This isn't all-caps `*_INFO` because it's not necessarily
   * expected to be a constant value.
   */
  get buildInfo() {
    return this._buildInfo.info;
  }

  /**
   * {object} Ad-hoc object with generally-useful runtime info, intended for
   * logging / debugging.
   *
   * **Note:** This isn't all-caps `*_INFO` because it's not a constant value,
   * due to the fact that `process.cwd()` and `process.ppid` could possibly
   * change.
   */
  get runtimeInfo() {
    return {
      nodeVersion: process.version.replace(/^v/, ''),
      platform:    process.platform,
      arch:        process.arch,
      pid:         process.pid,
      ppid:        process.ppid,
      directories: {
        product: Dirs.theOne.BASE_DIR,
        var:     Dirs.theOne.VAR_DIR,
        cwd:     process.cwd()
      }
    };
  }

  /** {ShutdownManager} The shutdown manager. */
  get shutdownManager() {
    return this._shutdownManager;
  }

  /**
   * Initializes this module. This does everything that can't be done (or done
   * safely) synchronously in the constructor.
   */
  async init() {
    this._shutdownManager.init();
    if (this._shutdownManager.shouldShutDown()) {
      log.error('Server found shutdown indicator(s) during startup.');
      throw Errors.aborted('Server told not to run.');
    }

    const alreadyRunning = await this.isAlreadyRunningLocally();
    if (alreadyRunning) {
      log.error(
        'Another server is already running locally.\n' +
        'Exiting so as not to trample it.');
      throw Errors.aborted('Another server is already running.');
    }

    this._pidFile.init();
  }

  /**
   * Checks to see if a server is already running on this machine. This is
   * called by {@link #init} to avoid trampling on another process, and it can
   * be called directly (before calling `init()`) as needed, too. (In
   * particular, the latter case is handy when trying to run tests in a local
   * development environment.)
   *
   * @returns {boolean} `true` if a server seems to be running locally already,
   *   or `false` if not.
   */
  async isAlreadyRunningLocally() {
    // Check the PID file. If it's non-existent or invalid, then it's reasonable
    // to say there is no server running. And if it _does_ exist and _is_ valid,
    // then the so-identified process needs to be running.

    const pid = this._pidFile.readFile();

    if (pid === null) {
      return false;
    }

    if (!is_running(pid)) {
      // Indicates that the last incarnation of the server crashed instead of
      // shutting down cleanly.
      log.event.stalePidFile({ pid });
      return false;
    }

    // There is an identified process, which really does seem to be running.
    // However, if it's not answering HTTP requests, then we'll consider it
    // dead.

    const isActive = new Promise((resolve) => {
      const request = http.get(Network.loopbackUrl);

      request.setTimeout(10 * 1000); // Give the server 10 seconds to respond.
      request.end();

      request.on('response', (response) => {
        response.setTimeout(10 * 1000);

        response.on('data', () => {
          // Ignore the payload. The `http` API requires us to acknowledge the
          // data. (There are other ways of doing so too, but this is the
          // simplest.)
        });

        response.on('end', () => {
          // Successful request. That means that, yes, there is indeed already
          // a server running.
          resolve(true);
        });

        response.on('timeout', () => {
          request.abort();
          resolve(false);
        });
      });

      request.on('error', (error_unused) => {
        resolve(false);
      });

      request.on('timeout', () => {
        request.abort();
        resolve(false);
      });
    });

    const result = await isActive;

    if (!result) {
      log.warn(
        'Another server process is running, but it does not seem to be\n' +
        'answering HTTP requests.');
    }

    return result;
  }
}
