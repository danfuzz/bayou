// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ansiHtml from 'ansi-html';
import chalk from 'chalk';
import { escape } from 'lodash';

import { BaseSink, SeeAll } from '@bayou/see-all';
import { TInt } from '@bayou/typecheck';

import Redactor from './Redactor';

/**
 * Implementation of the `@bayou/see-all` logging sink protocol which collects a
 * rolling compendium of recently logged items.
 */
export default class RecentSink extends BaseSink {
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
     * be at level `1`, which is what the `ansi-html` module supports.
     * **TODO:** Update this when `ansi-html` gets level `4` support. See
     * <https://github.com/Tjatse/ansi-html/issues/10>.
     */
    this._chalk = new chalk.constructor({ level: 1 });

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
   * Converts the given log line to HTML.
   *
   * @param {LogRecord} logRecord Log record.
   * @returns {string} HTML string form for the entry.
   */
  _htmlLine(logRecord) {
    const ck      = this._chalk;
    let   prefix  = logRecord.prefixString;
    const context = logRecord.contextString || '';
    let   body;

    if (logRecord.isTime()) {
      const [utc, local] = logRecord.timeStrings;
      const utcString    = ck.blue.bold(utc);
      const localString  = ck.blue.dim.bold(local);
      body = `${utcString} ${ck.dim.bold('/')} ${localString}`;
    } else {
      // Distill the message (or event) down to a single string, and trim
      // leading and trailing newlines.
      body = logRecord.messageString.replace(/(^\n+)|(\n+$)/g, '');

      if (logRecord.isEvent()) {
        body = ck.dim.bold(body);
      }
    }

    // Color the prefix depending on the event name / severity level.
    switch (logRecord.payload.name) {
      case 'error': { prefix = ck.red.bold(prefix);    break; }
      case 'warn':  { prefix = ck.yellow.bold(prefix); break; }
      default:      { prefix = ck.dim.bold(prefix);    break; }
    }

    const prefixHtml  = ansiHtml(escape(prefix));
    const contextHtml = ansiHtml(escape(ck.blue.dim.bold(context)));
    const bodyHtml    = ansiHtml(escape(body));

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
