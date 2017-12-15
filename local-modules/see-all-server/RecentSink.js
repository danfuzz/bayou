// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ansiHtml from 'ansi-html';
import chalk from 'chalk';
import escapeHtml from 'escape-html';

import { BaseSink, LogRecord, SeeAll } from 'see-all';
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
   * Saves a log record to this instance.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  log(logRecord) {
    const messageString = logRecord.messageString;
    this._log.push(logRecord.withMessage(messageString));
  }

  /**
   * Logs the indicated time value as "punctuation" on the log. This class
   * also uses this call to trigger cleanup of old items.
   *
   * @param {Int} timeMsec Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(timeMsec, utcString, localString) {
    const logRecord = new LogRecord(timeMsec, null, 'info', 'time', utcString, localString);

    this._log.push(logRecord);

    // Trim the log.

    const oldestMsec = timeMsec - this._maxAgeMsec;

    let i;
    for (i = 0; i < this._log.length; i++) {
      if (this._log[i].timeMsec >= oldestMsec) {
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

    result.push('<style>');
    result.push(
      'table { border-collapse: collapse; border-spacing: 0; ' +
      '  width: 90vw; margin-left: 5vw; margin-right: 5vw; }\n' +
      'tr:nth-child(even) { background-color: #f8f8f8; }\n' +
      'td { padding-bottom: 0.2em; padding-left: 0.5em; }\n' +
      'td:first-child { width: 15%; vertical-align: top; padding-right: 1em; ' +
      '  border-right-color: #ddd; border-right-width: 1pt; border-right-style: solid }\n' +
      'pre { white-space: pre-wrap; margin: 0; }'
    );
    result.push('</style>');

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
   * @param {LogRecord} logRecord Log record.
   * @returns {string} HTML string form for the entry.
   */
  static _htmlLine(logRecord) {
    let prefix = logRecord.prefix;
    let body;

    if (logRecord.tag === 'time') {
      const [utc, local] = logRecord.message;
      const utcString = chalk.blue.bold(utc);
      const localString = chalk.blue.dim.bold(local);
      body = `${utcString} ${chalk.dim.bold('/')} ${localString}`;
    } else {
      body = logRecord.message[0];
      body = body.replace(/(^\n+)|(\n+$)/g, ''); // Trim leading and trailing newlines.
    }

    // Color the prefix according to level.
    switch (logRecord.level) {
      case 'error': { prefix = chalk.red.bold(prefix);    break; }
      case 'warn':  { prefix = chalk.yellow.bold(prefix); break; }
      default:      { prefix = chalk.dim.bold(prefix);    break; }
    }

    const prefixHtml = ansiHtml(escapeHtml(prefix));
    const bodyHtml   = ansiHtml(escapeHtml(body));

    return `<tr><td>${prefixHtml}</td><td><pre>${bodyHtml}</pre></td>`;
  }
}
