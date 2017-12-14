// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { CommonBase, Errors } from 'util-common';

/** {array<string>} Array of valid severity levels. */
const LEVELS_ARRAY = Object.freeze(['debug', 'error', 'warn', 'info', 'detail']);

/** {Set<string>} Set of valid severity levels. */
const LEVELS_SET = new Set(LEVELS_ARRAY);

/**
 * Entry for an item to log. Contains the message to log as well as a bunch
 * of extra info.
 */
export default class LogRecord extends CommonBase {
  /** {array<string>} Array of all valid levels. */
  static get LEVELS() {
    return LEVELS_ARRAY;
  }

  /**
   * Validates a logging severity level value. Throws an error if invalid.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {string} `level`, if it is indeed valid.
   */
  static validateLevel(level) {
    if (!LEVELS_SET.has(level)) {
      throw Errors.bad_value(level, 'logging severity level');
    }

    return level;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  constructor(timeMsec, level, tag, ...message) {
    super();

    /** {Int} Timestamp of the message. */
    this._timeMsec = TInt.nonNegative(timeMsec);

    /** {string} Severity level. */
    this._level = LogRecord.validateLevel(level);

    /** {string} Name of the component associated with the message. */
    this._tag = TString.label(tag);

    /** {array<*>} Message to log. */
    this._message = message;

    Object.freeze(this);
  }

  /** {string} Severity level. */
  get level() {
    return this._level;
  }

  /** {array<*>} Message to log. */
  get message() {
    return this._message;
  }

  /** {string} Name of the component associated with the message. */
  get tag() {
    return this._tag;
  }

  /** {Int} Timestamp of the message. */
  get timeMsec() {
    return this._timeMsec;
  }
}
