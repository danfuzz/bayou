// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility class to convert a BodyDelta to HTML
 */
export class BodyDeltaHtml extends UtilityClass {
  /**
   * Produces an HTML representation of the contents of this instance.
   *
   * @param {BodyDelta} bodyDelta The delta to convert to HTML.
   * @param {CustomConverter} [customConverter = null] Optional custom
   *   converter to account for custom op types.
   * @param {Config} [config = null] The custom configuration to pass to the
   *   QuillDeltaToHtmlConverter library.
   *
   * @returns {string} An HTML representation of the contents of given delta.
   */
  static toHtmlForm(bodyDelta, customConverter = null, config = {}) {
    const quillOps = bodyDelta.toQuillForm().ops;
    const converter = new QuillDeltaToHtmlConverter(quillOps, config);

    if (customConverter !== null) {
      converter.renderCustomWith(customConverter);
    }

    return converter.convert();
  }
}
