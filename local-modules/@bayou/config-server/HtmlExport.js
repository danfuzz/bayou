// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding exporting HTML
 */
export class HtmlExport extends UtilityClass {

  /**
   * Converts the snapshot of given revision number to html.
   *
   * @param {string} documentId The id for the document in question.
   * @param {BodySnapshot} bodySnapshot The snapshot to convert
   *   to html.
   */
  static async exportHtml(documentId, bodySnapshot) {
    use.HtmlExport.exportHtml(bodySnapshot, documentId);
  }
}
