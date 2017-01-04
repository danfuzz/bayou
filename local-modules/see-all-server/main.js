// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import chalk from 'chalk';

import SeeAll from 'see-all';

/**
 * Number of columns to reserve for log line prefixes. Prefixes under this
 * length get padded.
 */
const PREFIX_COLS = 24;

/**
 * Implementation of the `SeeAll` logger protocol for use in a server context.
 */
export default class SeeAllServer {
  /**
   * Registers an instance of this class as a logger with the main `see-all`
   * module.
   */
  static init() {
    SeeAll.add(new SeeAllServer());
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
    const prefix = SeeAllServer._makePrefix(tag, level);

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

    if (maxLineWidth > (consoleWidth - prefix.length)) {
      const indent = '  ';
      console.log(prefix.text);
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
      let first = true;
      for (let l of lines) {
        console.log(`${prefix.text}${l}`);
        if (first) {
          first = false;
          prefix.text = ' '.repeat(prefix.length);
        }
      }
    }
  }

  /**
   * Logs the indicated time value as "punctuation" on the log.
   *
   * @param nowMsec The time.
   */
  time(nowMsec, utcString, localString) {
    utcString = chalk.blue.bold(utcString);
    localString  = chalk.blue.dim.bold(localString);
    const prefix = SeeAllServer._makePrefix('time');

    console.log(`${prefix.text}${utcString} / ${localString}`);
  }

  /**
   * Constructs a prefix header with the given tag (required) and level
   * (optional).
   *
   * @param tag The tag.
   * @param level (optional) The level.
   * @returns a map with the `text` and the `length`. The latter is handy in
   *   that it doesn't include the count of the characters used in color control
   *   sequences.
   */
  static _makePrefix(tag, level = '') {
    let text = `[${tag}${level !== '' ? ' ' : ''}${level}]`;

    if (text.length < PREFIX_COLS) {
      text += ' '.repeat(PREFIX_COLS - text.length);
    }

    const length = text.length + 1; // `+1` for the space at the end.

    // Color the prefix according to level.
    switch (level) {
      case 'error': { text = chalk.red.bold(text);    break; }
      case 'warn':  { text = chalk.yellow.bold(text); break; }
      default:      { text = chalk.dim.bold(text);    break; }
    }

    text += ' ';

    return {text: text, length: length};
  }
}
