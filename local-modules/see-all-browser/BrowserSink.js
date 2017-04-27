// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SeeAll } from 'see-all';

/**
 * Implementation of the `Logger` logger protocol for use in a web browser
 * context.
 */
export default class BrowserSink {
  /**
   * Registers an instance of this class as a logging sink with the main
   * `see-all` module.
   */
  static init() {
    SeeAll.add(new BrowserSink());
  }

  /**
   * Constructs an instance.
   */
  constructor() {
    // Nothing to do.
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param {number} nowMsec_unused Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...string} message Message to log.
   */
  log(nowMsec_unused, level, tag, ...message) {
    const prefix = `[${tag} ${level}]`;
    const style  = 'color: #bbb; font-weight: bold';

    // The browser's `console` methods _mostly_ do the right thing with regard
    // to providing distinguishing markings and stack traces when appropriate.
    // We just disagree about `debug`, so in that case we include the message
    // and a trace in a "group."

    let logMethod;
    switch (level) {
      case 'error': { logMethod = console.error; break; } // eslint-disable-line no-console
      case 'warn':  { logMethod = console.warn;  break; } // eslint-disable-line no-console
      default:      { logMethod = console.log;   break; } // eslint-disable-line no-console
    }

    if (level === 'debug') {
      // **Note:** The ES spec indicates that `group()` doesn't take arguments,
      // but in practice a single argument is accepted and used usefully by most
      // browsers. In the case of Chrome, this argument is used instead of a
      // useless default header of literally `console.group`.
      console.group(prefix);        // eslint-disable-line no-console
    }

    logMethod.call(console, `%c${prefix}`, style, ...message);

    if (level === 'debug') {
      console.trace('stack trace'); // eslint-disable-line no-console
      console.groupEnd();           // eslint-disable-line no-console
    }
  }

  /**
   * Logs the indicated time value as "punctuation" on the log.
   *
   * @param {number} nowMsec_unused Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec_unused, utcString, localString) {
    // eslint-disable-next-line no-console
    console.log(`%c[time] %c${utcString} %c/ %c${localString}`,
      'color: #bbb; font-weight: bold',
      'color: #66a; font-weight: bold',
      'color: #bbb; font-weight: bold',
      'color: #99e; font-weight: bold');
  }
}
