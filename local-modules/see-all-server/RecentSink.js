// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ansiHtml from 'ansi-html';
import chalk from 'chalk';

import { BaseSink, SeeAll } from 'see-all';
import { TInt } from 'typecheck';

/**
 * Implementation of the `see-all` logging sink protocol which collects a
 * rolling compendium of recently logged items.
 */
export default class RecentSink extends BaseSink {
  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `see-all` module.
   *
   * @param {number} maxAgeMsec The maximum age of logged items before they age
   *   out of the list.
   */
  constructor(maxAgeMsec) {
    super();

    /** {Int} Maximum age. */
    this._maxAgeMsec = TInt.nonNegative(maxAgeMsec);

    /** {array<object>} The log contents. */
    this._log = [];

    SeeAll.theOne.add(this);
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param {Int} nowMsec Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  log(nowMsec, level, tag, ...message) {
    message = BaseSink.stringifyMessage(...message);
    const details = { nowMsec, level, tag, message };
    this._log.push(details);
  }

  /**
   * Logs the indicated time value as "punctuation" on the log. This class
   * also uses this call to trigger cleanup of old items.
   *
   * @param {Int} nowMsec Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec, utcString, localString) {
    const tag = 'time';
    const details = { nowMsec, tag, utcString, localString };
    this._log.push(details);

    // Trim the log.

    const oldestMsec = nowMsec - this._maxAgeMsec;

    let i;
    for (i = 0; i < this._log.length; i++) {
      if (this._log[i].nowMsec >= oldestMsec) {
        break;
      }
    }

    if (i !== 0) {
      this._log = this._log.slice(i);
    }
  }

  /** {array<object>} The saved contents of this log. */
  get contents() {
    return this._log;
  }

  /** {string} The saved contents of this log as an HTML string. */
  get htmlContents() {
    const result = [];

    result.push('<table>');

    for (const l of this._log) {
      result.push(RecentSink._htmlLine(l));
    }

    result.push('</table>');
    return result.join('\n');
  }

  /**
   * Converts the given log line to HTML.
   *
   * @param {object} log Structured log entry.
   * @returns {string} HTML string form for the entry.
   */
  static _htmlLine(log) {
    let tag, body;

    if (log.tag === 'time') {
      const utcString = chalk.blue.bold(log.utcString);
      const localString = chalk.blue.dim.bold(log.localString);
      tag = '[time]';
      body = `${utcString} ${chalk.dim.bold('/')} ${localString}`;
    } else {
      tag = `[${log.tag} ${log.level}]`;
      body = log.message;
    }

    // Color the prefix according to level.
    switch (log.level) {
      case 'error': { tag = chalk.red.bold(tag);    break; }
      case 'warn':  { tag = chalk.yellow.bold(tag); break; }
      default:      { tag = chalk.dim.bold(tag);    break; }
    }

    const tagHtml = ansiHtml(tag);
    const bodyHtml = ansiHtml(body);

    return `<tr><td>${tagHtml}</td><td>${bodyHtml}</td>`;
  }
}
