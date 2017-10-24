// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import is_running from 'is-running';
import http from 'http';

import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { Errors, UtilityClass } from 'util-common';

import Dirs from './Dirs';
import PidFile from './PidFile';
import ProductInfo from './ProductInfo';

/** {Logger} Logger. */
const log = new Logger('env-server');

/**
 * Miscellaneous server-side utilities.
 */
export default class ServerEnv extends UtilityClass {
  /**
   * Initializes this module. This sets up the info for the `Dirs` class, sets
   * up the PID file, and gathers the product metainfo.
   */
  static async init() {
    Dirs.theOne;

    const alreadyRunning = await ServerEnv.isAlreadyRunningLocally();
    if (alreadyRunning) {
      log.error(
        'Another server is already running locally.\n' +
        'Exiting so as not to trample it.');
      throw Errors.aborted('Another server is already running.');
    }

    PidFile.theOne.init();
    ProductInfo.theOne;
  }

  /**
   * Checks to see if a server is already running on this machine. This is
   * called by `ServerEnv.init()` to avoid trampling on another process, and it
   * can be called directly (before calling `ServerEnv.init()`) as needed, too.
   * (In particular, the latter case is handy when trying to run tests in a
   * local development environment.)
   *
   * @returns {boolean} `true` if a server seems to be running locally already,
   *   or `false` if not.
   */
  static async isAlreadyRunningLocally() {
    // Check the PID file. If it's non-existent or invalid, then it's reasonable
    // to say there is no server running. And if it _does_ exist and _is_ valid,
    // then the so-identified process needs to be running.

    const pid = PidFile.theOne.readFile();

    if (pid === null) {
      return false;
    }

    if (!is_running(pid)) {
      log.warn(`Stale PID file indicates non-existent process: ${pid}`);
      return false;
    }

    // There is an identified process, which really does seem to be running.
    // However, if it's not answering HTTP requests, then we'll consider it
    // dead.

    const isActive = new Promise((resolve, reject_unused) => {
      const request = http.get(ServerEnv.loopbackUrl);

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

  /**
   * {string} The base URL to use for loopback requests from this machine. This
   * is always an `http://localhost/` URL.
   */
  static get loopbackUrl() {
    return `http://localhost:${Hooks.theOne.listenPort}`;
  }
}
