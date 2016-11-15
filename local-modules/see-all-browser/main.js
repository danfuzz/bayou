// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import SeeAll from 'see-all';

/**
 * Implementation of the `SeeAll` logger protocol for use in a web browser
 * context.
 */
export default class SeeAllBrowser {
  /**
   * Registers an instance of this class as a logger with the main `see-all`
   * module.
   */
  static init() {
    SeeAll.add(new SeeAllBrowser());
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
   * @param level Severity level.
   * @param message Message to log.
   */
  log(nowMsec, level, tag, ...message) {
    const prefix = `%c[${tag} ${level}]`;
    const style  = 'color: #bbb; font-weight: bold';

    // The browser's `console` methods _mostly_ do the right thing with regard
    // to providing distinguishing markings and stack traces when appropriate.
    // We just disagree about `debug`, so in that case we include the message
    // and a trace in a "group."

    let logMethod;
    switch (level) {
      case 'debug': { logMethod = console.group; break; }
      case 'error': { logMethod = console.error; break; }
      case 'warn':  { logMethod = console.warn;  break; }
      default:      { logMethod = console.log;   break; }
    }

    logMethod.call(console, prefix, style, ...message);

    if (level === 'debug') {
      console.trace('stack trace');
      console.groupEnd();
    }
  }

  /**
   * Logs the indicated time value as "punctuation" on the log.
   *
   * @param nowMsec The time.
   */
  time(nowMsec, utcString, localString) {
    const date = new Date(nowMsec);

    console.log(`%c[time] %c${utcString} %c/ %c${localString}`,
      'color: #bbb; font-weight: bold',
      'color: #66a; font-weight: bold',
      'color: #bbb; font-weight: bold',
      'color: #99e; font-weight: bold');
  }
}
