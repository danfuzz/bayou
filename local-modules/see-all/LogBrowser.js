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
    const prefix = `[${tag} ${level}]`;
    console.log(prefix, ...message);
  }
}
