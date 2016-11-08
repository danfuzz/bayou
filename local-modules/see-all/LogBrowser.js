// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * The code that actually does logging in the context of a web browser. This
 * gets loaded by `main.js` when running in a browser.
 */
export default class LogBrowser {
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
  log(level, tag, ...message) {
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
}
