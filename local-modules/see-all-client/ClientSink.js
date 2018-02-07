// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSink, SeeAll } from 'see-all';

// The whole point of this file is to use `console.<whatever>`, so...
/* eslint-disable no-console */

/**
 * Implementation of the `see-all` logging sink protocol for use in a web
 * browser context. It logs everything to the browser window console.
 */
export default class ClientSink extends BaseSink {
  /**
   * Registers an instance of this class as a logging sink with the main
   * `see-all` module.
   */
  static init() {
    SeeAll.theOne.add(new ClientSink());
  }

  /**
   * Writes a log record to the console.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  _impl_sinkLog(logRecord) {
    if (logRecord.isTime()) {
      // Special colorful markup for timestamps.
      this._logTime(logRecord);
      return;
    }

    const payload = logRecord.payload;
    const [prefixFormat, ...args] = this._makePrefix(logRecord);
    const formatStr = [prefixFormat]; // We append to this array and `args`.

    let logMethod;
    switch (payload.name) {
      case 'error': { logMethod = 'error'; break; }
      case 'warn':  { logMethod = 'warn';  break; }
      default:      { logMethod = 'log';   break; }
    }

    if (logRecord.isEvent()) {
      formatStr.push('%c%s');
      args.push('color: #840; font-weight: bold');
      args.push(` ${payload.name}(`);

      let first = true;
      for (const a of payload.args) {
        if (first) {
          first = false;
        } else {
          formatStr.push('%s');
          args.push(', ');
        }

        formatStr.push('%o');
        args.push(a);
      }

      formatStr.push('%s');
      args.push(')');
    } else {
      for (const a of payload.args) {
        switch (typeof a) {
          case 'object':   { formatStr.push((a === null) ? ' %s' : ' %o'); break; }
          case 'function': { formatStr.push(' %o');                        break; }
          default:         { formatStr.push(' %s');                        break; }
        }

        args.push(a);
      }
    }

    console[logMethod](formatStr.join(''), ...args);

    if (payload.name === 'debug') {
      // The browser's `console` methods _mostly_ do the right thing with regard
      // to providing distinguishing markings and stack traces when appropriate.
      // We just disagree about `debug`, so in that case we include an explicit
      // trace in a "group."
      console.groupCollapsed('stack trace');
      console.trace('stack trace');
      console.groupEnd();
    }
  }

  /**
   * Logs the indicated time record.
   *
   * @param {LogRecord} logRecord Log record, which must be for a time.
   */
  _logTime(logRecord) {
    const [utc, local] = logRecord.timeStrings;
    console.log(`%c[time] %c${utc} %c/ %c${local}`,
      'color: #999; font-weight: bold',
      'color: #66a; font-weight: bold',
      'color: #999; font-weight: bold',
      'color: #99e; font-weight: bold');
  }

  /**
   * Constructs a prefix header for the given record. The return value is an
   * array suitable for passing to a `log()` method, including an initial format
   * string and additional arguments as appropriate.
   *
   * @param {LogRecord} logRecord The log record in question.
   * @returns {array<string>} The prefix.
   */
  _makePrefix(logRecord) {
    // Color the prefix depending on the event name / severity level.
    let prefixColor;
    switch (logRecord.payload.name) {
      case 'error': { prefixColor = '#a44'; break; }
      case 'warn':  { prefixColor = '#a70'; break; }
      default:      { prefixColor = '#999'; break; }
    }

    let   formatStr = '%c%s';
    const args      = [`color: ${prefixColor}; font-weight: bold`, logRecord.prefixString];

    if (logRecord.contextString !== null) {
      formatStr += '%c%s';
      args.push('color: #44e; font-weight: bold');
      args.push(` ${logRecord.contextString}`);
    }

    // Reset the style at the end.
    formatStr += '%c';
    args.push('');

    return [formatStr, ...args];
  }
}
