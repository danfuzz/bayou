// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Logger } from 'see-all';
import { Singleton } from 'util-common';

import Dirs from './Dirs';

/** Logger. */
const log = new Logger('pid');

/**
 * This writes a PID file when `init()` is called, and tries to remove it when
 * the app is shutting down. This clas is _not_ meant to be instantiated.
 */
export default class PidFile extends Singleton {
  /**
   * Write the PID file, and arrange for its timely erasure.
   */
  constructor() {
    super();

    /** {string} Path for the PID file. */
    this._pidPath = path.resolve(Dirs.theOne.VAR_DIR, 'pid.txt');

    // Erase the file on exit.
    process.once('exit',    this._erasePid.bind(this));
    process.once('SIGINT',  this._handleSignal.bind(this, 'SIGINT'));
    process.once('SIGTERM', this._handleSignal.bind(this, 'SIGTERM'));

    // Write the PID file.
    fs.writeFileSync(this._pidPath, `${process.pid}\n`);

    log.info(`PID: ${process.pid}`);
  }

  /**
   * Handles a signal by erasing the PID file (if it exists) and then
   * re-raising the same signal.
   *
   * @param {string} id Signal ID.
   */
  _handleSignal(id) {
    log.info(`Received signal: ${id}`);
    this._erasePid();
    process.kill(process.pid, id);
  }

  /**
   * Erases the PID file if it exists.
   */
  _erasePid() {
    try {
      fs.unlinkSync(this._pidPath);
      log.info(`Removed PID file.`);
    } catch (e) {
      // Ignore errors. We're about to exit anyway.
    }
  }
}
