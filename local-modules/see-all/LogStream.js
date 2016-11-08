// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

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
   * @param logger Underlying logger to use.
   * @param level Severity level to log at.
   */
  constructor(logger, level) {
    /** Underlying logger to use. */
    this._logger = logger;

    /** Severity level. */
    this._level = level;
  }

  /**
   * Implementation of standard `stream.Writable` method.
   */
  write(chunk, encoding, callback) {
    if (typeof chunk !== 'string') {
      // Assume it's a buffer, which it's supposed to be if it's not a string.
      chunk = chunk.toString(encoding);
    }

    this._logger.log(this._level, chunk);

    if (callback) {
      // Use `then()` to make the callback happen in its own tick/turn.
      Promise.resolve(true).then((value) => { callback(); });
    }
  }

  /**
   * Implementation of standard `stream.Writable` method.
   */
  end(chunk, encoding, callback) {
    // We don't pass the `callback` because this stream never actually gets
    // ended (which is when the `callback` would be called).
    this.write(chunk, encoding);
  }
}
