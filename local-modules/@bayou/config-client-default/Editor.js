// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the setup of interactive editors.
 */
export default class Editor extends UtilityClass {
  /**
   * {Quill} Implementation of standard configuration point. See `package.json`
   * in this directory for details of the version we return here.
   */
  static get Quill() {
    return Quill;
  }

  /**
   * Implementation of standard configuration point. This implementation is a
   * no-op.
   *
   * @param {object} window_unused Window which will ultimately contain one or
   *   more editors.
   * @param {string} baseUrl_unused Base URL that points to the server to use.
   */
  static aboutToRun(window_unused, baseUrl_unused) {
    // This space intentionally left blank.
  }

  /**
   * Implementation of standard configuration point. This implementation is a
   * no-op.
   *
   * @param {EditorComplex} editorComplex_unused The editor complex in question.
   */
  static editorComplexInit(editorComplex_unused) {
    // This space intentionally left blank.
  }

  /**
   * Implementation of standard configuration point. This implementation is a
   * no-op, returning `defaultConfig` as-is.
   *
   * @param {string} contextName_unused The name of the context.
   * @param {object} defaultConfig The default module configuration.
   * @returns {object} The desired module configuration.
   */
  static quillModuleConfig(contextName_unused, defaultConfig) {
    return defaultConfig;
  }

  /**
   * Implementation of standard configuration point. This implementation always
   * returns `bubble`, which is a standard Quill theme.
   *
   * @param {string} contextName_unused The name of the context.
   * @returns {string} `bubble`, always.
   */
  static quillThemeName(contextName_unused) {
    return 'bubble';
  }
}
