// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Singleton } from 'util-common';

/**
 * Hooks into various client-side operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * Called on every `EditorComplex` instance that is constructed, just before
   * making it active from the user's perspective. This hook is expected to
   * (or at least allowed to) perform initialization on the Quill instances
   * within the complex.
   *
   * @param {EditorComplex} editorComplex_unused The editor complex in question.
   */
  editorComplexInit(editorComplex_unused) {
    // This space intentionally left blank.
  }

  /**
   * Called during application startup. This is called just after the logging
   * library has been set up and before almost everything else. It is called
   * in the context of setting up an editor within a web page.
   *
   * @param {object} window_unused Window which contains the application being
   *   set up.
   * @param {string} baseUrl_unused Base URL that points to the server to use.
   * @returns {Promise|undefined} A promise whose resolution indicates the end
   *   of hook activity, or `undefined` if there is nothing to wait for.
   */
  run(window_unused, baseUrl_unused) {
    // This space intentionally left (nearly) blank.
    return undefined;
  }

  /**
   * Called to construct the Quill module configuration for the indicated
   * context. This is only ever called once per context (per run of the
   * application), and not, e.g., once per instantiation of a `Quill` object).
   * This (default) implementation returns the given default configuration
   * as-is.
   *
   * @param {string} contextName_unused The name of the context. This is one of
   *   `body` (for the main editor) or `title` (for the title field editor).
   * @param {object} defaultConfig The default module configuration for this
   *   context.
   * @returns {object} The desired module configuration.
   */
  quillModuleConfig(contextName_unused, defaultConfig) {
    return defaultConfig;
  }

  /**
   * Called to get the name of the Quill theme to use for the indicated
   * context. This (default) implementation always returns `bubble`. If this
   * hook is overlaid, it is up to the overlay to initialize the theme
   * (presumably in the `run()` hook).
   *
   * @param {string} contextName_unused The name of the context. This is one of
   *   `body` (for the main editor) or `title` (for the title field editor).
   * @returns {string} The desired theme name.
   */
  quillThemeName(contextName_unused) {
    return 'bubble';
  }
}
