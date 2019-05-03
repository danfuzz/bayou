// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Property file reader. This accepts a syntax which is similar to traditional
 * Java `.properties` files, except considerably simpler, more
 * straightforward, and a bit more modern.
 *
 * Files consist of UTF-8 encoded characters.
 *
 * Property bindings are lines of the form `<key> = <value>` where both `<key>`
 * and `<value>` must either be quoted strings (either single or double quotes)
 * or be non-spaced "words" consisting of (7-bit) alphanumerics and/or the
 * following characters: `-` `_` `.` '/'
 *
 * Comments consist of a hash sign (`#`) followed by any number of characters
 * until a newline.
 *
 * Blank lines (and lines consisting only of comments) are ignored.
 *
 * Quoted strings may contain any characters within them (including newlines).
 * Backslash (`\`) introduces an escape sequence. The following escape sequences
 * are recognized:
 *
 * * `\\` &mdash; A literal backslash.
 * * `\'` &mdash; A single quote.
 * * `\"` &mdash; A double quote.
 * * `\n` &mdash; A newline.
 * * `\t` &mdash; A tab.
 *
 * The result of parsing a property file is always a frozen object which maps
 * `<key>` to `<value>` for each such pair defined in the file.
 */
export class Proppy extends UtilityClass {
  /**
   * Reads a property file from the given buffer.
   *
   * @param {Buffer} source The property file source.
   * @returns {object} Object as described in the class header.
   */
  static parseBuffer(source) {
    const contents = source.toString('utf8');
    return Proppy.parseString(contents);
  }

  /**
   * Reads a property file at the given path.
   *
   * @param {string} path The filesystem path of the property file.
   * @returns {object} Object as described in the class header.
   */
  static parseFile(path) {
    const contents = fs.readFileSync(path, { encoding: 'utf8' });
    return Proppy.parseString(contents);
  }

  /**
   * Reads a property file from the given string.
   *
   * @param {string} source The property file source.
   * @returns {object} Object as described in the class header.
   */
  static parseString(source) {
    const tokens = Proppy._tokenize(source);
    const keys = new Set();
    const result = {};

    for (let at = 0; at < tokens.length; at++) {
      const t = tokens[at];
      switch (t.type) {
        case 'eol': {
          // Blank line (or comment-only line).
          break;
        }

        case 'string': {
          // Look for assignment.
          const eq = tokens[at + 1];
          const value = tokens[at + 2];
          const eol = tokens[at + 3];
          if (   eq    && (eq.type    === 'equals')
              && value && (value.type === 'string')
              && eol   && (eol.type   === 'eol')) {
            // Valid assignment form.
            const key = t.value;
            if (keys.has(key)) {
              // Already have this key.
              throw Errors.badData(`Duplicate key: \`${key}\``);
            }
            keys.add(key);
            result[key] = value.value;
            at += 3;
            break;
          }
        }
        // fallthrough

        default: {
          const value = t.value ? ` \`${t.value}\`` : '';
          throw Errors.badData(`Syntax error at \`${t.type}\` token${value}.`);
        }
      }
    }

    return Object.freeze(result);
  }

  /**
   * Tokenizes a string.
   *
   * @param {string} source The property file source.
   * @returns {object[]} Array of tokens.
   */
  static _tokenize(source) {
    const result = [];
    let   match = [''];

    for (;;) {
      // Slice off the characters from the previous iteration.
      source = source.slice(match[0].length);

      if (source === '') {
        break;
      }

      match = /^[ \t]+/.exec(source) || /^#[^\n]*/.exec(source);
      if (match) {
        // Whitespace or comment: Skip it. **Note:** Newlines are significant
        // to the grammar, so we don't consume them here.
        continue;
      }

      match = /^\n/.exec(source);
      if (match) {
        result.push({ type: 'eol' });
        continue;
      }

      match = /^=/.exec(source);
      if (match) {
        result.push({ type: 'equals' });
        continue;
      }

      match = /^[-_./a-zA-Z0-9]+/.exec(source);
      if (match) {
        result.push({ type: 'string', value: match[0] });
        continue;
      }

      match = /^'([^\\']|(\\.))*'/.exec(source) || /^"([^\\"]|(\\.))*"/.exec(source);
      if (match) {
        // Quoted string: Trim the quotes, and parse characters.
        const contents = Proppy._parseQuotedString(match[0].slice(1, -1));
        result.push({ type: 'string', value: contents });
        continue;
      }

      const context = (source.length > 10)
        ? `${source.slice(0, 10)}...`
        : source;
      throw Errors.badData(`Invalid character at: \`${context}\``);
    }

    // We treat the string as always ending with a newline.
    result.push({ type: 'eol' });

    return result;
  }

  /**
   * Parses the contents of a quoted string.
   *
   * @param {string} source The source string.
   * @returns {string} The parsed form.
   */
  static _parseQuotedString(source) {
    const result = [];
    let   match = [''];

    for (;;) {
      // Slice off the characters from the previous iteration.
      source = source.slice(match[0].length);

      if (source === '') {
        break;
      }

      match = /^[^\\]+/.exec(source);
      if (match) {
        // Literal text.
        result.push(source.slice(0, match[0].length));
        continue;
      }

      match = /^\\./.exec(source);
      if (match) {
        const ch = source[1];
        let replacement = null;
        switch (ch) {
          case 'n':  { replacement = '\n'; break; }
          case 't':  { replacement = '\t'; break; }
          case '\\': { replacement = '\\'; break; }
          case '\'': { replacement = '\''; break; }
          case '"':  { replacement = '"';  break; }
          default: {
            throw Errors.badData(`Invalid escape character in quoted string: \`${source[0]}\``);
          }
        }

        result.push(replacement);
        continue;
      }

      throw Errors.badData(`Invalid character in quoted string: \`${source[0]}\``);
    }

    return result.join('');
  }
}
