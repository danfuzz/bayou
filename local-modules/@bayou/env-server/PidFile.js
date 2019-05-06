// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Logger } from '@bayou/see-all';
import { TInt } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import { Dirs } from './Dirs';

/** {Logger} Logger. */
const log = new Logger('pid');

/**
 * This writes a PID file when {@link #init} is called, and tries to remove it
 * when the process is shutting down.
 */
export class PidFile extends CommonBase {
  /**
   * Constructs an instance. Logging aside, this doesn't cause any external
   * action to take place (such as writing the PID file); that stuff happens in
   * {@link #init}.
   */
  constructor() {
    super();

    /** {string} Path for the PID file. */
    this._pidPath = path.resolve(Dirs.theOne.CONTROL_DIR, 'pid.txt');

    Object.freeze(this);
  }

  /**
   * Writes the PID file, and arranges for its timely erasure. This should only
   * get called if we are reasonably sure there isn't another local server
   * process running.
   */
  init() {
    // Erase the file on exit.
    process.once('exit',    this._erasePid.bind(this));
    process.once('SIGINT',  this._handleSignal.bind(this, 'SIGINT'));
    process.once('SIGTERM', this._handleSignal.bind(this, 'SIGTERM'));

    // Write the PID file.
    fs.writeFileSync(this._pidPath, `${process.pid}\n`);

    log.event.pidInitialized({ pid: process.pid });
  }

  /**
   * Reads and parses the contents of the PID file, if it exists and contains
   * a valid process ID (followed by a newline).
   *
   * @returns {Int|null} The process ID contained in the file if the file is
   *   valid, or `null` if the file doesn't exist or contains invalid data.
   */
  readFile() {
    try {
      const text  = fs.readFileSync(this._pidPath, { encoding: 'utf8' });
      const match = text.match(/^([0-9]+)\n$/);

      if (match === null) {
        return null;
      }

      // `TInt.check()` ensures it's a "safe" integer.
      const result = TInt.check(parseInt(match));

      log.event.serverAlreadyRunning({ pid: result });

      return result;
    } catch (e) {
      // `ENOENT` is "file not found." Anything else is logworthy.
      if (e.code !== 'ENOENT') {
        log.error('Trouble reading PID file.', e);
      }
      return null;
    }
  }

  /**
   * Erases the PID file if it exists.
   */
  _erasePid() {
    try {
      fs.unlinkSync(this._pidPath);
      log.event.removedPidFile();
    } catch (e) {
      // Ignore errors. We're about to exit anyway.
    }
  }

  /**
   * Handles a signal by erasing the PID file (if it exists) and then
   * re-raising the same signal.
   *
   * @param {string} id Signal ID.
   */
  _handleSignal(id) {
    log.event.receivedSignal(id);
    this._erasePid();
    process.kill(process.pid, id);
  }
}
