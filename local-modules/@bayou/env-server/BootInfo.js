// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Logger, LogRecord } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import Dirs from './Dirs';

/** {Logger} Logger for this class. */
const log = new Logger('boot-info');

/**
 * Information about the booting of this server.
 */
export default class BootInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} buildId The build ID of this server's build (used to figure
   *   out how many times this same build has been booted).
   */
  constructor(buildId) {
    super();

    const bootTime = Date.now();

    /** {string} The build ID. */
    this._buildId = TString.check(buildId);

    /** {Int} Time (Unix-epoch msec) when the server booted. */
    this._bootTime = bootTime;

    /** {string} String form of the boot time. */
    this._bootTimeString = LogRecord.forTime(bootTime).timeStrings.join(' / ');

    /** {string} Path for the boot count file. */
    this._bootCountPath = path.resolve(Dirs.theOne.CONTROL_DIR, 'boot-count.txt');

    /** {Int} Count of how many times this build has been booted. */
    this._bootCount = this._determineBootCount();

    Object.freeze(this);
  }

  /**
   * {object} Ad-hoc object with the info from this instance.
   *
   * **Note:** This isn't all-caps `INFO` because it's not necessarily expected
   * to be a constant value in the long term (even though it happens to be so
   * as of this writing).
   */
  get info() {
    return {
      bootCount:  this._bootCount,
      time:       this._bootTimeString,
      timeMsec:   this._bootTime,
      uptimeMsec: this.uptimeMsec
    };
  }

  /** {Int} The length of time this server has been running, in msec. */
  get uptimeMsec() {
    return Date.now() - this._bootTime;
  }

  /**
   * Returns the number of times that this build (by ID) has been started on
   * this server. It does this by reading the build ID file (if present) and
   * (re)writing it (to update the statistic).
   *
   * @returns {Int} The number of times this build has booted.
   */
  _determineBootCount() {
    const buildId = this._buildId;
    let bootCount = 1;

    try {
      const text = fs.readFileSync(this._bootCountPath, { encoding: 'utf8' });
      const obj  = JSON.parse(text);

      if (obj.buildId === buildId) {
        bootCount = obj.bootCount + 1;
      }
    } catch (e) {
      // `ENOENT` is "file not found." Anything else is logworthy.
      if (e.code !== 'ENOENT') {
        log.error('Trouble reading boot-count file.', e);
      }
    }

    const newText = `${JSON.stringify({ bootCount, buildId }, null, 2)}\n`;
    fs.writeFileSync(this._bootCountPath, newText, { encoding: 'utf8' });

    return bootCount;
  }
}
