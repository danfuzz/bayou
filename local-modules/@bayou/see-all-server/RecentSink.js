// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import AnsiUp from 'ansi_up';
import chalk from 'chalk';
import { inspect } from 'util';

import { BaseSink, SeeAll } from '@bayou/see-all';
import { TInt } from '@bayou/typecheck';

import { Redactor } from './Redactor';

/**
 * Implementation of the `@bayou/see-all` logging sink protocol which collects a
 * rolling compendium of recently logged items.
 */
export class RecentSink extends BaseSink {
  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `@bayou/see-all` module.
   *
   * @param {number} maxAgeMsec The maximum age of logged items before they age
   *   out of the list.
   */
  constructor(maxAgeMsec) {
    super();

    /** {Int} Maximum age. */
    this._maxAgeMsec = TInt.nonNegative(maxAgeMsec);

    /**
     * {Chalk} Chalk instance to use. We don't just use the global `chalk`, as
     * it gets configured for the observed TTY, and this class wants it to
     * be at level `3` for maximum fidelity when converting to HTML.
     */
    this._chalk = new chalk.constructor({ level: 3 });

    /** {AnsiUp} ANSI-to-HTML converter to use. */
    this._ansiUp = new AnsiUp();

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
      result.push(this._htmlLine(l));
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
    logRecord = Redactor.redact(logRecord);

    this._log.push(logRecord);

    if (logRecord.isTime()) {
      this._trim(logRecord.timeMsec);
    }
  }

  /**
   * Converts the given ANSI-bearing string to HTML.
   *
   * @param {string} s String to convert.
   * @returns {string} Converted form.
   */
  _fromAnsi(s) {
    return this._ansiUp.ansi_to_html(s);
  }

  /**
   * Converts the given log line to HTML.
   *
   * @param {LogRecord} logRecord Log record.
   * @returns {string} HTML string form for the entry.
   */
  _htmlLine(logRecord) {
    const ck         = this._chalk;
    let   prefix     = logRecord.prefixString;
    const context    = logRecord.contextString || '';
    const metricName = logRecord.metricName;
    let   body;

    if (logRecord.isTime()) {
      const [utc, local] = logRecord.timeStrings;
      const utcString    = ck.blue.bold(utc);
      const localString  = ck.hex('#88f').bold(local);
      body = `${utcString} ${ck.hex('#888').bold('/')} ${localString}`;
    } else if (metricName !== null) {
      const args  = logRecord.payload.args;
      const label = `${metricName}${(args.length === 0) ? '' : ': '}`;
      let   argString;

      switch (args.length) {
        case 0:  { argString = '';               break; }
        case 1:  { argString = inspect(args[0]); break; }
        default: { argString = inspect(args);    break; }
      }

      body = `${ck.hex('#503').bold(label)}${argString}`;
    } else {
      // Distill the message (or event) down to a single string, and trim
      // leading and trailing newlines.
      body = logRecord.messageString.replace(/(^\n+)|(\n+$)/g, '');

      if (logRecord.isEvent()) {
        body = ck.hex('#884').bold(body);
      }
    }

    // Color the prefix depending on the event name / severity level.
    switch (logRecord.payload.name) {
      case 'error': { prefix = ck.red.bold(prefix);         break; }
      case 'warn':  { prefix = ck.yellow.bold(prefix);      break; }
      default:      { prefix = ck.hex('#888').bold(prefix); break; }
    }

    const prefixHtml  = this._fromAnsi(prefix);
    const contextHtml = this._fromAnsi(ck.hex('#88f').bold(context));
    const bodyHtml    = this._fromAnsi(body);

    return `<tr><td>${prefixHtml}</td><td>${contextHtml}</td><td><pre>${bodyHtml}</pre></td>`;
  }

  /**
   * Trims the log of older items.
   *
   * @param {Int} timeMsec The time of the most recent log record.
   */
  _trim(timeMsec) {
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
}
