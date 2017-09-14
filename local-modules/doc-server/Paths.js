// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber } from 'doc-common';
import { StoragePath } from 'file-store';
import { TString } from 'typecheck';
import { Errors, UtilityClass } from 'util-common';

/**
 * Utility class that just provides the common `StoragePath` strings used
 * by the document storage format.
 */
export default class Paths extends UtilityClass {
  /**
   * {string} `StoragePath` prefix string for document body (main content)
   * information.
   */
  static get BODY_PREFIX() {
    return '/body';
  }

  /** {string} `StoragePath` prefix string for document changes. */
  static get BODY_CHANGE_PREFIX() {
    return `${Paths.BODY_PREFIX}/change`;
  }

  /**
   * {string} `StoragePath` string for the body content revision number.
   * This corresponds to the highest change number.
   */
  static get BODY_REVISION_NUMBER() {
    return `${Paths.BODY_PREFIX}/revision_number`;
  }

  /** {string} `StoragePath` prefix string for caret information. */
  static get CARET_PREFIX() {
    return '/caret';
  }

  /** {string} `StoragePath` prefix string for caret session data. */
  static get CARET_SESSION_PREFIX() {
    return `${Paths.CARET_PREFIX}/session`;
  }

  /**
   * {string} `StoragePath` string used to flag updates to the set of active
   * sessions. The way this is used is that any change to this value causes the
   * caret storage code to refresh its list of active sessions. When a new
   * session is added or an old one goes away, the server that makes that change
   * also changes the value stored here to something new. See {@link
   * CaretStorage#_caretSetUpdate} for details.
   */
  static get CARET_SET_UPDATE_FLAG() {
    return `${Paths.CARET_PREFIX}/set_update`;
  }

  /** {string} `StoragePath` string for the file schema (format) version. */
  static get SCHEMA_VERSION() {
    return '/schema_version';
  }

  /**
   * Gets the `StoragePath` string corresponding to the indicated revision
   * number, specifically to store the document change that results in that
   * revision.
   *
   * @param {RevisionNumber} revNum The revision number.
   * @returns {string} The corresponding `StoragePath` string for document
   *   change storage.
   */
  static forBodyChange(revNum) {
    RevisionNumber.check(revNum);
    return `${Paths.BODY_CHANGE_PREFIX}/${revNum}`;
  }

  /**
   * Gets the `StoragePath` string corresponding to the indicated session,
   * specifically to store caret data for that session.
   *
   * @param {string} sessionId The session ID.
   * @returns {string} The corresponding `StoragePath` string for caret
   *   information.
   */
  static forCaret(sessionId) {
    TString.check(sessionId);
    return `${Paths.CARET_SESSION_PREFIX}/${sessionId}`;
  }

  /**
   * Takes a full storage path for a caret and returns the session ID part of
   * it. This is the reverse of `forCaret()`.
   *
   * @param {string} path The full storage path.
   * @returns {string} The corresponding caret session ID.
   */
  static sessionFromCaretPath(path) {
    if (!StoragePath.isPrefix(Paths.CARET_SESSION_PREFIX, path)) {
      throw Errors.bad_value(path, 'caret path');
    }

    const split = StoragePath.split(path);
    return split[split.length - 1];
  }
}
