// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Hooks into various client-side operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class HooksClient {
  /**
   * Called during application startup. This is called just after the logging
   * library has been set up and before almost everything else.
   */
  static run() {
    // This space intentionally left blank.
  }

  /**
   * Called on every `Quill` instance that is constructed, just before returning
   * it to the client.
   *
   * @param {Quill} quill_unused The initialized instance (except for whatever
   *   needs to be done here).
   */
  static quillInstanceInit(quill_unused) {
    // This space intentionally left blank.
  }

  /**
   * Called to construct the Quill toolbar configuration. This is only ever
   * called once per run of the application (and not, e.g., once per
   * instantiation of a `Quill` object).
   *
   * @param {object} defaultConfig The default toolbar configuration.
   * @returns {object} The desired toolbar configuration.
   */
  static quillToolbarConfig(defaultConfig) {
    return defaultConfig;
  }
}
