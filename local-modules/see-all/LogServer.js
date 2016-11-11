// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import chalk from 'chalk';

/**
 * Number of columns to reserve for log line prefixes. Prefixes under this
 * length get padded.
 */
const PREFIX_COLS = 24;

/**
 * The code that actually does logging in the context of a server. This gets
 * loaded by `main.js` when running in a browser.
 */
export default class LogServer {
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
    let prefix = `[${tag} ${level}] `;
    if (prefix.length < PREFIX_COLS) {
      prefix += ' '.repeat(PREFIX_COLS - prefix.length);
    }
    const prefixLength = prefix.length; // Don't be fooled by the color codes.

    // Color the prefix according to level.
    switch (level) {
      case 'error': { prefix = chalk.red.bold(prefix);    break; }
      case 'warn':  { prefix = chalk.yellow.bold(prefix); break; }
      default:      { prefix = chalk.dim.bold(prefix);    break; }
    }

    // Make a unified string of the entire message.
    let text = '';
    let atLineStart = true;
    for (let m of message) {
      if (typeof m === 'object') {
        // Convert the object to a string. If it's a single line, just add it
        // to the text inline. If it's multiple lines, make sure it all ends up
        // on its own lines.
        m = util.inspect(m);
        if (/\n/.test(m)) {
          text += `${atLineStart ? '' : '\n'}${m}\n`
          atLineStart = true;
        } else {
          text += `${atLineStart ? '' : ' '}${m}`;
          atLineStart = false;
        }
      } else {
        text += `${atLineStart ? '' : ' '}${m}`;
        atLineStart = (typeof m === 'string') ? /\n$/.test(m) : false;
      }
    }

    if ((level !== 'detail') && (level !== 'info')) {
      // It's at a level that warrants a stack trace. Append it. We drop the
      // first couple lines, because those are (a) the exception header which is
      // info-free in this case, and (b) lines corresponding to the logging
      // code itself.
      let trace = util.inspect(new Error());
      trace = trace.replace(/^[\s\S]*\n    at SeeAll[^\n]+\n/, '');
      trace = trace.replace(/^    at /mg, '  at '); // Partially outdent.
      text += `${atLineStart ? '' : '\n'}${trace}`;
    }

    // Remove the trailing newline, if any, and split on newlines to produce an
    // array of all lines. The final-newline removal means we won't (typically)
    // have an empty line at the end of the log.
    const lines = text.replace(/\n$/, '').match(/^.*$/mg);

    // Measure every line. If all lines are short enough for the current
    // console, align them to the right of the prefix. If not, put the prefix on
    // its own line and produce the main content just slightly indented, under
    // the prefix.

    const consoleWidth = Math.max(process.stdout.getWindowSize()[0] || 80, 80);
    const maxLineWidth = lines.reduce(
      (prev, l) => { return Math.max(prev, l.length); },
      0);

    if (maxLineWidth > (consoleWidth - prefixLength)) {
      const indent = '  ';
      console.log(prefix);
      for (let l of lines) {
        let indent = '  ';
        while (l) {
          const chunk = l.substring(0, consoleWidth - indent.length);
          l = l.substring(chunk.length);
          console.log(`${indent}${chunk}`);
          indent = ' +';
        }
      }
    } else {
      for (let l of lines) {
        console.log(`${prefix}${l}`);
      }
    }
  }
}
