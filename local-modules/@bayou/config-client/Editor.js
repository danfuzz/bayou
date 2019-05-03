// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the setup of interactive editors.
 */
export class Editor extends UtilityClass {
  /**
   * {Quill} The class to use as the Quill editor. The interface of this class
   * is expected to be compatible with the `Quill` class as defined by the Quill
   * project.
   */
  static get Quill() {
    return use.Editor.Quill;
  }

  /**
   * {QuillProm} A subclass of `Quill` which supports promise-chain event
   * access, as exemplified in the default implementation of this configuration
   * point in `config-client-default`.
   */
  static get QuillProm() {
    return use.Editor.QuillProm;
  }

  /**
   * Performs any webpage-global setup needed in order for the page to host one
   * or more editors. This is called exactly once per page load, early during
   * initialization and specifically _before_ any programmatic DOM manipulation
   * has been done by the system.
   *
   * @param {object} window Window which will ultimately contain one or more
   *   editors.
   * @param {string} serverUrl URL at which to contact the server.
   * @returns {Promise|undefined} A promise whose resolution indicates the end
   *   of hook activity, or `undefined` if there is nothing to wait for.
   */
  static aboutToRun(window, serverUrl) {
    return use.Editor.aboutToRun(window, serverUrl);
  }

  /**
   * Performs any additional setup needed per `EditorComplex` instance that is
   * constructed, just before making it active from the user's perspective. This
   * is expected to (or at least allowed to) perform configuration on the Quill
   * instances within the complex.
   *
   * @param {EditorComplex} editorComplex The editor complex in question.
   */
  static editorComplexInit(editorComplex) {
    use.Editor.editorComplexInit(editorComplex);
  }

  /**
   * Provides the Quill module configuration for the indicated context. This is
   * only ever called once per context (per run of the application), and not,
   * e.g., once per instantiation of a `Quill` object). It is okay for the
   * implementation to destructively modify the `defaultConfig` it is passed.
   *
   * @param {string} contextName The name of the context. This is one of `body`
   *   (for the main editor) or `title` (for the title field editor).
   * @param {object} defaultConfig The default module configuration for this
   *   context.
   * @returns {object} The desired module configuration.
   */
  static quillModuleConfig(contextName, defaultConfig) {
    return use.Editor.quillModuleConfig(contextName, defaultConfig);
  }

  /**
   * Provides the name of the Quill theme to use for the indicated context.
   * Call pattern and context semantics are the same as with
   * {@link #quillModuleConfig}, see which.
   *
   * @param {string} contextName The name of the context.
   * @returns {string} The desired theme name.
   */
  static quillThemeName(contextName) {
    return use.Editor.quillThemeName(contextName);
  }
}
