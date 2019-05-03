// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';
import { Logger } from '@bayou/see-all';

/** {Logger} Logger. */
const log = new Logger('html-export');

/**
 * Utility functionality regarding exporting HTML
 */
export class HtmlExport extends UtilityClass {
/**
 * Converts the snapshot of given revision number to html.
 *
 * @param {string} docId_unused The id for the document in question.
 * @param {BodySnapshot} bodySnapshot_unused The snapshot to convert
 *   to html.
 */
  static async exportHtml(docId_unused, bodySnapshot_unused) {
    // TODO: Add local HTML export when needed.
    log.info('Local deploy - skipping HTML export.');
  }
}
