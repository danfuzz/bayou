// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TObject } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-core';

import { PropertyIterable } from './PropertyIterable';

/** {string} How anonymous functions are represented in V8. */
const V8_ANONYMOUS = '<anonymous>';

/** {string} How this module represents anonymous functions. */
const ANONYMOUS_FUNCTION = V8_ANONYMOUS;

/**
 * Error helper utilities.
 */
export class ErrorUtil extends UtilityClass {
  /**
   * Gets a full trace "dump" of an error, in a consistent format meant to be
   * reasonable for logging. This includes the error name and message, a clean
   * stack trace, any additional properties (e.g., `code` is a common one used
   * by Node), and the same info for an `Error` instance bound as a `cause`
   * property if present.
   *
   * @param {Error} error Error value.
   * @param {string} [indent = ''] String to use for indentation on each line.
   * @returns {string} Corresponding inspection string.
   */
  static fullTrace(error, indent = '') {
    const lines = ErrorUtil.fullTraceLines(error, indent);
    return lines.join('\n');
  }

  /**
   * Like {@link #fullTrace}, but returns an array of individual lines.
   *
   * @param {Error} error Error value.
   * @param {string} [indent = ''] String to use for indentation on each line.
   * @returns {array<string>} Corresponding inspection string, as an array of
   *   individual lines.
   */
  static fullTraceLines(error, indent = '') {
    TObject.check(error, Error);

    const indent2   = `${indent}  `;
    const causeLine = [`${indent2}caused by:`];
    const traces    = [];
    let   first     = true;

    while (error !== null) {
      const { cause, lines } = ErrorUtil._oneTrace(error, indent);

      if (first) {
        first = false;
        indent = indent2;
      } else {
        traces.push(causeLine);
      }

      traces.push(lines);
      error = cause;
    }

    return [].concat(...traces);
  }

  /**
   * Gets an array of stack lines out of an error, in a consistent format meant
   * to be reasonable for logging.
   *
   * @param {Error} error Error value.
   * @param {string} [indent = ''] String to use for indentation on each line.
   * @returns {array<string>} Cleaned up error stack as an array of lines, each
   *   one corresponding to one call in the stack.
   */
  static stackLines(error, indent = '') {
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

      lines[i] = `${indent}${line}`;
    }

    return lines;
  }

  /**
   * Helper for {@link #fullTraceLines}, which produces the lines for a single
   * error in a causal chain, and also returns the next cause in the chain (if
   * any).
   *
   * @param {Error} error Error to inspect.
   * @param {string} indent String to prepend on each result line.
   * @returns {object} Plain object that binds `lines` to an array of lines, and
   *   `cause` to the chained cause or to `null` if there is no chained cause.
   */
  static _oneTrace(error, indent) {
    const indent2  = `${indent}  `;
    let   cause    = null;
    const extra    = {};
    let   anyExtra = false;

    const iter = new PropertyIterable(error).skipObject().skipSynthetic().skipMethods().onlyPublic();
    for (const prop of iter) {
      const name = prop.name;
      if ((name === 'name') || (name === 'message') || (name === 'stack')) {
        // These are handled more directly, below.
        continue;
      } else if ((name === 'cause') && (prop.value instanceof Error)) {
        // This is handled via the outer call.
        cause = prop.value;
        continue;
      }

      extra[prop.name] = prop.value;
      anyExtra = true;
    }

    let extraLines;
    if (anyExtra) {
      extraLines = inspect(extra).split('\n').map(line => `${indent2}${line}`);
    } else {
      extraLines = [];
    }

    const stack = ErrorUtil.stackLines(error, indent2);

    // The message can contain multiple lines. (The name too, though that'd be
    // pretty unusual.)
    const message =
      `${error.name}: ${error.message}`.split('\n').map(line => `${indent}${line}`);

    return {
      cause,
      lines: [
        ...message,
        ...stack,
        ...extraLines
      ]
    };
  }
}
