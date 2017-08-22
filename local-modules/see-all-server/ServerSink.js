// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import chalk from 'chalk';

import { SeeAll } from 'see-all';
import { Singleton } from 'util-common';

/**
 * Number of columns to reserve for log line prefixes. Prefixes under this
 * length get padded.
 */
const PREFIX_COLS = 24;

/**
 * Implementation of the `see-all` logging sink protocol for use in a server
 * context. It logs everything to the console.
 */
export default class ServerSink extends Singleton {
  /**
   * Registers an instance of this class as a logging sink with the main
   * `see-all` module.
   */
  static init() {
    SeeAll.theOne.add(ServerSink.theOne);
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
    const prefix = ServerSink._makePrefix(tag, level);

    // Make a unified string of the entire message.
    let text = '';
    let atLineStart = true;
    let gotError = false;
    for (let m of message) {
      if (typeof m === 'object') {
        if (m instanceof Error) {
          gotError = true; // Used after the `for` loop, below.
        }

        // Convert the object to a string. If it's a single line, just add it
        // to the text inline. If it's multiple lines, make sure it all ends up
        // on its own lines.
        m = util.inspect(m);
        if (/\n/.test(m)) {
          text += `${atLineStart ? '' : '\n'}${m}\n`;
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

    if (!gotError && (level !== 'detail') && (level !== 'info')) {
      // It's at a level that warrants a stack trace, and none of the arguments
      // is an `Error`. So, append one. We drop the first couple lines, because
      // those are (a) the `Error` header, which is info-free in this case; and
      // (b) lines corresponding to the logging code itself.
      let trace = util.inspect(new Error());
      trace = trace.replace(/^[\s\S]*\n    at Logger[^\n]+\n/, '');
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

    const consoleWidth = ServerSink._consoleWidth();
    const maxLineWidth = lines.reduce(
      (prev, l) => { return Math.max(prev, l.length); },
      0);

    if (maxLineWidth > (consoleWidth - prefix.length)) {
      // eslint-disable-next-line no-console
      console.log(prefix.text);
      for (let l of lines) {
        let indent = '  ';
        while (l) {
          const chunk = l.substring(0, consoleWidth - indent.length);
          l = l.substring(chunk.length);
          // eslint-disable-next-line no-console
          console.log(`${indent}${chunk}`);
          indent = '+ ';
        }
      }
    } else {
      let first = true;
      for (const l of lines) {
        // eslint-disable-next-line no-console
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
   * @param {number} nowMsec_unused Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec_unused, utcString, localString) {
    utcString = chalk.blue.bold(utcString);
    localString  = chalk.blue.dim.bold(localString);
    const prefix = ServerSink._makePrefix('time');

    // eslint-disable-next-line no-console
    console.log(`${prefix.text}${utcString} / ${localString}`);
  }

  /**
   * Constructs a prefix header with the given tag (required) and level
   * (optional).
   *
   * @param {string} tag The component tag.
   * @param {string} [level = ''] The severity level.
   * @returns {object} an object that maps `text` and `length`. The latter is
   *   handy in that it _doesn't_ include the count of the characters used in
   *   color control sequences.
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

    return { text, length };
  }

  /**
   * Figures out the width of the console (if attached) or a reasonable default
   * if not.
   *
   * @returns {number} The console width.
   */
  static _consoleWidth() {
    if (!process.stdout.isTTY) {
      return 80;
    }

    return Math.max(process.stdout.getWindowSize()[0] || 80, 80);
  }
}
