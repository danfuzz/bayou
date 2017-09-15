// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

import Logger from './Logger';

/**
 * Adaptor which provides a writable stream on top of a logger at a particular
 * severity level.
 *
 * **Note:** This implements just the basic functionality, _not_ including any
 * events or flow control.
 */
export default class LogStream {
  /**
   * Constructs an instance.
   *
   * @param {Logger} logger Underlying logger to use.
   * @param {string} level Severity level to log at.
   */
  constructor(logger, level) {
    /** {Logger} Underlying logger to use. */
    this._logger = Logger.check(logger);

    /** {string} Severity level. */
    this._level = TString.check(level);
  }

  /**
   * Implementation of standard `stream.Writable` method.
   *
   * @param {string|Buffer} chunk What to write.
   * @param {string} [encoding_unused = null] Name of character encoding to use
   *   when `chunk` is passed as a string. Ignored in this case because this
   *   class operates on strings and so never has a reason to convert a string
   *   into a `Buffer`.
   * @param {function} [callback = null] Function to call after writing is
   *   complete.
   */
  write(chunk, encoding_unused = null, callback = null) {
    if (typeof chunk !== 'string') {
      // Assume it's a buffer, which it's supposed to be if it's not a string.
      // We assume that it's been encoded as UTF-8, because (a) that's usual,
      // and (b) we have no affordance to be told otherwise. (Notably, the
      // `encoding` parameter is for how to convert a string into bytes, not the
      // other way around.)
      chunk = chunk.toString();
    }

    this._logger.log(this._level, chunk);

    if (callback) {
      // Make the callback happen in its own tick/turn.
      (async () => {
        await Promise.resolve(true);
        callback();
      })();
    }
  }

  /**
   * Implementation of standard `stream.Writable` method.
   *
   * @param {string|Buffer} chunk What to write.
   * @param {string} [encoding = null] Name of character encoding to use when
   *   `chunk` is passed as a string.
   * @param {function} [callback_unused = null] Function to call after stream
   *   is closed. This is marked as unused because, as implemented, logger
   *   streams _never_ actually get closed.
   */
  end(chunk, encoding = null, callback_unused = null) {
    // We don't pass the `callback` because this stream never actually gets
    // ended (which is when the `callback` would be called).
    this.write(chunk, encoding);
  }
}
