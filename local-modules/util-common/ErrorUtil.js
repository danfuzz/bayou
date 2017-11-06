// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';
import { UtilityClass } from 'util-core';

/** {string} How anonymous functions are represented in V8. */
const V8_ANONYMOUS = '<anonymous>';

/** {string} How this module represents anonymous functions. */
const ANONYMOUS_FUNCTION = V8_ANONYMOUS;

/**
 * JSON helper utilities.
 */
export default class JsonUtil extends UtilityClass {
  /**
   * Gets an array of stack lines out of an error, in a consistent format meant
   * to be reasonable for logging.
   *
   * @param {Error} error Error value.
   * @returns {array<string>} Cleaned up error stack as an array of lines, each
   *   one corresponding to one call in the stack.
   */
  static stackLines(error) {
    TObject.check(error, Error);

    let stack = error.stack;

    if (typeof stack !== 'string') {
      return [];
    }

    // Sometimes (on some platforms, notably V8/Chrome/Node), the `stack` starts
    // with a header "line" consisting of the error name and message. ("Line" is
    // in scare quotes because it can end up containing embedded newlines.) If
    // it does, then strip it off before doing further processing.
    const messagePrefix = (error.message === '')
      ? `${error.name}\n`
      : `${error.name}: ${error.message}\n`;
    if (stack.startsWith(messagePrefix)) {
      stack = stack.slice(messagePrefix.length);
    }

    // Get an array of all non-empty lines. Each should represent a stack frame
    // (but we act conservatively because there's no hard guarantee, and code
    // that we don't directly control can end up doing surprising things).
    const lines = stack.replace(/(^\n+)|(\n+$)/g, '').split(/\n+/);

    // Transform lines that are in a recognized format into our preferred form.
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      const v8Match = line.match(/^ +at ([^()]+)(?: \(([^()]+)\))?$/);
      if (v8Match !== null) {
        // Looks like V8/Chrome/Node, specifically something of the form
        // `    at func.name (/path/to/file:NN:NN)`, where `func.name` might
        // actually be `new func.name` or `func.name [as other.name]` (or both),
        // or of the form `    at /path/to/file:NN:NN` for anonymous contexts
        // (including top-level code).
        let funcName;
        let filePath;

        if (v8Match[2] === undefined) {
          funcName = ANONYMOUS_FUNCTION;
          filePath = v8Match[1];
          if (filePath === V8_ANONYMOUS) {
            filePath = '';
          }
        } else {
          funcName = v8Match[1];
          filePath = v8Match[2];
        }

        // Trim `filePath` to highlight the interesting end portion and drop the
        // noisy initial portion.
        const MAX_PATH = 65;
        filePath = filePath.replace(/^.*[/]node_modules[/]/, '.../');
        if (filePath.length > MAX_PATH) {
          const split = filePath.split(/[/]+/);

          filePath = '';
          for (const name of split.reverse()) {
            if ((name === '...') || ((name.length + filePath.length + 1) > MAX_PATH)) {
              filePath = `.../${filePath}`;
              break;
            }
            filePath = (filePath === '') ? name : `${name}/${filePath}`;
          }
        }

        line = (filePath === '')
          ? funcName
          : `${funcName} (${filePath})`;
      }

      // **TODO:** Something reasonable if the stack looks like it came from
      // WebKit/Safari.

      lines[i] = line;
    }

    return lines;
  }
}
