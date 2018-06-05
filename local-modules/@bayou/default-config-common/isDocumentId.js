// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';

/**
 * Checks whether the given value is syntactically valid as a document ID.
 * This method is only ever called with a non-empty string.
 *
 * The default implementation of this method requires that document IDs have
 * no more than 32 characters and only use ASCII alphanumerics plus dash (`-`)
 * and underscore (`_`).
 *
 * @param {string} id The (alleged) document ID to check.
 * @returns {boolen} `true` iff `id` is syntactically valid.
 */
export default function isDocumentId(id) {
  TString.check(id);

  return /^[-_a-zA-Z0-9]{1,32}$/.test(id);
}
