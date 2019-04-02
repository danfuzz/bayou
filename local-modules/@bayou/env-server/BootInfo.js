// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Logger, LogRecord } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import Dirs from './Dirs';

/** {Int} Maximum length of the `errors` string, in characters. */
const MAX_ERRORS_LENGTH = 5000;

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

    /** {string} Path for the boot info file. */
    this._bootInfoPath = path.resolve(Dirs.theOne.CONTROL_DIR, 'boot-info.txt');

    /** {object} Plain object of durable boot info. */
    this._info = this._readFileWithDefaults();

    Object.seal(this);

    this._logBoot();
    this._writeFile();
  }

  /** {Int} Count of how many times this build has been booted. */
  get bootCount() {
    return this._info.bootCount;
  }

  /** {string} The build ID. */
  get buildId() {
    return this._info.buildId;
  }

  /**
   * {object} Ad-hoc object with the info from this instance.
   *
   * **Note:** This isn't all-caps `INFO` because it's not necessarily expected
   * to be a constant value in the long term (even though it happens to be so
   * as of this writing).
   */
  get info() {
    const extras = {
      time:       this._bootTimeString,
      timeMsec:   this._bootTime,
      uptimeMsec: this.uptimeMsec
    };

    return Object.assign(extras, this._info);
  }

  /** {Int} Count of how many times this build has been shut down cleanly. */
  get shutdownCount() {
    return this._info.shutdownCount;
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
   * Records an error which caused server shutdown, for inclusion in the
   * instance of this class upon the _next_ server start.
   *
   * @param {string} error Stringified error.
   */
  recordError(error) {
    TString.check(error);

    if (!error.endsWith('\n')) {
      error += '\n';
    }

    let   errors    = this._info.errors;
    const separator = errors.endsWith('\n') ? '' : '\n';

    errors = `${errors}${separator}${error}`;

    // Truncate to the desired maximum length, by trimming off the initial
    // portion, in units of whole lines.

    while (errors.length > MAX_ERRORS_LENGTH) {
      const lineEndAt = errors.indexOf('\n');
      if ((lineEndAt < 0) || (lineEndAt === (errors.length - 1))) {
        // The whole string is a single line, which shouldn't happen (/shrug).
        // Just truncate the right number of characters and call it a day.
        errors = errors.slice(errors.length - MAX_ERRORS_LENGTH);
      } else {
        // Trim away the line.
        errors = errors.slice(lineEndAt + 1);
      }
    }

    this._info.errors = errors;

    this._writeFile();
  }

  /**
   * Logs the `boot` metric.
   */
  _logBoot() {
    const { bootCount, buildId, shutdownCount } = this;
    log.metric.boot({ buildId, bootCount, shutdownCount });
  }

  /**
   * Reads and parses the boot info file, returning its contents and/or
   * replacement info. If the build ID matches, this fills in any missing info
   * with defaults, and increments the boot count. If the build ID doesn't match
   * (including if the file is not present at all), returns all defaults.
   *
   * @returns {object} Plain object with info file contents with defaults for
   *   missing bits.
   */
  _readFileWithDefaults() {
    const buildId = this._buildId;
    const info    = { buildId, bootCount: 0, errors: '', shutdownCount: 0 };

    try {
      const text = fs.readFileSync(this._bootInfoPath, { encoding: 'utf8' });
      const obj  = JSON.parse(text);

      if (obj.buildId === buildId) {
        Object.assign(info, obj);
      }
    } catch (e) {
      // `ENOENT` is "file not found." Anything else is logworthy.
      if (e.code !== 'ENOENT') {
        log.error('Trouble reading boot-info file.', e);
      }
    }

    info.bootCount++;
    return info;
  }

  /**
   * Writes the boot info file.
   */
  _writeFile() {
    const text = `${JSON.stringify(this._info, null, 2)}\n`;
    fs.writeFileSync(this._bootInfoPath, text, { encoding: 'utf8' });
  }
}