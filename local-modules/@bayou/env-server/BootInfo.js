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

    const { bootCount, shutdownCount } = this._determineCounts();

    /** {Int} Count of how many times this build has been booted. */
    this._bootCount = bootCount;

    /** {Int} Count of how many times this build has been shut down cleanly. */
    this._shutdownCount = shutdownCount;

    Object.seal(this);

    this._logBoot();
    this._writeFile();
  }

  /** {Int}  Count of how many times this build has been booted. */
  get bootCount() {
    return this._bootCount;
  }

  /** {string} The build ID. */
  get buildId() {
    return this._buildId;
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
      bootCount:     this._bootCount,
      shutdownCount: this._shutdownCount,
      time:          this._bootTimeString,
      timeMsec:      this._bootTime,
      uptimeMsec:    this.uptimeMsec
    };
  }

  /** {Int} Count of how many times this build has been shut down cleanly. */
  get shutdownCount() {
    return this._shutdownCount;
  }

  /** {Int} The length of time this server has been running, in msec. */
  get uptimeMsec() {
    return Date.now() - this._bootTime;
  }

  /**
   * Increments the shutdown count, and writes the resulting modified info to
   * the boot info file.
   */
  incrementShutdownCount() {
    this._shutdownCount++;
    this._writeFile();
  }

  /**
   * Returns the number of times that this build (by ID) has been started and
   * shut down on this server. It does this by reading the build ID file (if
   * present) and (re)writing it (to update the statistic).
   *
   * @returns {object} Ad-hoc plain object mapping `bootCount` and
   *   `shutdownCount`, each an integer.
   */
  _determineCounts() {
    const buildId     = this._buildId;
    let bootCount     = 1;
    let shutdownCount = 0;

    try {
      const text = fs.readFileSync(this._bootCountPath, { encoding: 'utf8' });
      const obj  = JSON.parse(text);

      if (obj.buildId === buildId) {
        bootCount     = (obj.bootCount || 0) + 1;
        shutdownCount = obj.shutdownCount || 0;
      }
    } catch (e) {
      // `ENOENT` is "file not found." Anything else is logworthy.
      if (e.code !== 'ENOENT') {
        log.error('Trouble reading boot-count file.', e);
      }
    }

    return { bootCount, shutdownCount };
  }

  /**
   * Logs the `boot` metric.
   */
  _logBoot() {
    const { bootCount, buildId, shutdownCount } = this;
    log.metric.boot({ buildId, bootCount, shutdownCount });
  }

  /**
   * Writes the boot info file.
   */
  _writeFile() {
    const { buildId, bootCount, shutdownCount } = this;
    const text = `${JSON.stringify({ buildId, bootCount, shutdownCount }, null, 2)}\n`;
    fs.writeFileSync(this._bootCountPath, text, { encoding: 'utf8' });
  }
}
