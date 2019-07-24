// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * {LogTag|null} Instance to use when logging log system metainfo.
 * Initialized in {@link #LOG}.
 */
let LOG = null;

/**
 * {LogTag|null} Instance to use when logging timestamp "punctuation."
 * Initialized in {@link #TIME}.
 */
let TIME = null;

/**
 * Structured "tag" information for log records. Each instance consists of a
 * main tag and zero or more additional "context" strings. The main tag is
 * typically a high-level system component of some sort, e.g. and typically a
 * module. The context strings, if any, are specific to the main tag (defined
 * by the component being so represented).
 */
export class LogTag extends CommonBase {
  /** {LogTag} Instance to use when logging log system metainfo. */
  static get LOG() {
    if (LOG === null) {
      LOG = new LogTag('log');
    }

    return LOG;
  }

  /** {LogTag} Instance to use when logging timestamp "punctuation." */
  static get TIME() {
    if (TIME === null) {
      TIME = new LogTag('time');
    }

    return TIME;
  }

  /**
   * Validates a context string. This will throw an error given an invalid
   * value.
   *
   * @param {*} value Alleged context string.
   * @returns {string} `value`, if it is valid.
   */
  static checkContextString(value) {
    return TString.maxLen(value, 30);
  }

  /**
   * Constructs an instance.
   *
   * @param {string} main Main tag. Must be a "label" string.
   * @param {...string} context Context strings. Each must be no longer
   *   than 30 characters.
   */
  constructor(main, ...context) {
    super();

    /** {string} Main tag. */
    this._main = TString.label(main);

    /** {array<string>} Context strings. */
    this._context =
      Object.freeze(TArray.check(context, x => LogTag.checkContextString(x)));

    Object.freeze(this);
  }

  /** {array<string>} Context strings. Always a frozen array. */
  get context() {
    return this._context;
  }

  /** {string} Main tag. */
  get main() {
    return this._main;
  }

  /**
   * Constructs an instance just like this one, except with additional context
   * strings.
   *
   * @param {...string} context Additional context strings.
   * @returns {LogTag} An appropriately-constructed instance.
   */
  withAddedContext(...context) {
    return new LogTag(this._main, ...this._context, ...context);
  }
}
