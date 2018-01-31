// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ansiHtml from 'ansi-html';
import chalk from 'chalk';
import escapeHtml from 'escape-html';

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
      'td { vertical-align: top; padding-bottom: 0.2em; padding-left: 0.5em; }\n' +
      'td:first-child { width: 12%; padding-right: 1em; ' +
      '  border-right-color: #ddd; border-right-width: 1pt; border-right-style: solid }\n' +
      'td:nth-child(2) { width: 15%; padding-right: 1em; ' +
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
   * Saves a log record to this instance.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  _impl_sinkLog(logRecord) {
    if (logRecord.isTime()) {
      this._logTime(logRecord);
    } else {
      const messageString = logRecord.messageString;
      this._log.push(logRecord.withMessage(messageString));
    }
  }

  /**
   * Logs the indicated time value as "punctuation" on the log. Also, clean
   * up old items.
   *
   * @param {LogRecord} logRecord The time record.
   */
  _logTime(logRecord) {
    this._log.push(logRecord);

    // Trim the log.

    const timeMsec   = logRecord.timeMsec;
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

  /**
   * Converts the given log line to HTML.
   *
   * @param {LogRecord} logRecord Log record.
   * @returns {string} HTML string form for the entry.
   */
  static _htmlLine(logRecord) {
    const level   = logRecord.level;
    let   prefix  = logRecord.prefixString;
    const context = logRecord.contextString || '';

    let   body;

    if (logRecord.isTime()) {
      const [utc, local] = logRecord.timeStrings;
      const utcString = chalk.blue.bold(utc);
      const localString = chalk.blue.dim.bold(local);
      body = `${utcString} ${chalk.dim.bold('/')} ${localString}`;
    } else {
      body = logRecord.message[0];
      body = body.replace(/(^\n+)|(\n+$)/g, ''); // Trim leading and trailing newlines.
    }

    if ((level !== 'detail') && (level !== 'info')) {
      // It's at a level that warrants a stack trace...
      if (!logRecord.hasError()) {
        // It doesn't otherwise have an error, so append the stack of the call
        // site.
        for (const line of logRecord.stack.split('\n')) {
          body += `\n  ${line}`;
        }
      }
    }

    // Color the prefix according to level.
    switch (logRecord.level) {
      case 'error': { prefix = chalk.red.bold(prefix);    break; }
      case 'warn':  { prefix = chalk.yellow.bold(prefix); break; }
      default:      { prefix = chalk.dim.bold(prefix);    break; }
    }

    const prefixHtml  = ansiHtml(escapeHtml(prefix));
    const contextHtml = ansiHtml(escapeHtml(chalk.blue.dim.bold(context)));
    const bodyHtml    = ansiHtml(escapeHtml(body));

    return `<tr><td>${prefixHtml}</td><td>${contextHtml}</td><td><pre>${bodyHtml}</pre></td>`;
  }
}
