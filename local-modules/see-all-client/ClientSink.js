// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
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
   * Logs a message at the given severity level.
   *
   * @param {Int} nowMsec_unused Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  log(nowMsec_unused, level, tag, ...message) {
    const [prefixFormat, ...args] = this._makePrefix(level, tag);
    const formatStr = [prefixFormat]; // We append to this array and `args`.

    let logMethod;
    switch (level) {
      case 'error': { logMethod = 'error'; break; }
      case 'warn':  { logMethod = 'warn';  break; }
      default:      { logMethod = 'log';   break; }
    }

    for (const m of message) {
      switch (typeof m) {
        case 'object':   { formatStr.push((m === null) ? ' %s' : ' %o'); break; }
        case 'function': { formatStr.push(' %o');                        break; }
        default:         { formatStr.push(' %s');                        break; }
      }

      args.push(m);
    }

    console[logMethod](formatStr.join(''), ...args);

    if (level === 'debug') {
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
   * Logs the indicated time value as "punctuation" on the log.
   *
   * @param {Int} nowMsec_unused Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec_unused, utcString, localString) {
    console.log(`%c[time] %c${utcString} %c/ %c${localString}`,
      'color: #999; font-weight: bold',
      'color: #66a; font-weight: bold',
      'color: #999; font-weight: bold',
      'color: #99e; font-weight: bold');
  }

  /**
   * Constructs a prefix header with the given tag and level. The return value
   * is an array suitable for passing to a `log()` method, including an initial
   * format string and additional arguments as appropriate.
   *
   * @param {string} level The severity level.
   * @param {string} tag The component tag.
   * @returns {string} The prefix.
   */
  _makePrefix(level, tag) {
    const text = BaseSink.makePrefix(level, tag);

    let prefixColor;
    switch (level) {
      case 'error': { prefixColor = '#a44'; break; }
      case 'warn':  { prefixColor = '#a70'; break; }
      default:      { prefixColor = '#999'; break; }
    }

    return [
      '%c%s%c',
      `color: ${prefixColor}; font-weight: bold`,
      text,
      ''
    ];
  }
}
