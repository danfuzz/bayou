// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber } from 'doc-common';
import { UtilityClass } from 'util-common';

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

  /** {string} `StoragePath` prefix string for caret information. */
  static get CARET_PREFIX() {
    return '/caret';
  }

  /** {string} `StoragePath` prefix string for caret changes. */
  static get CARET_CHANGE_PREFIX() {
    return `${Paths.CARET_PREFIX}/change`;
  }

  /**
   * {string} `StoragePath` prefix string for property (metadata) information.
   */
  static get PROPERTY_PREFIX() {
    return '/prop';
  }

  /** {string} `StoragePath` prefix string for property changes. */
  static get PROPERTY_CHANGE_PREFIX() {
    return `${Paths.PROPERTY_PREFIX}/change`;
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
   * Gets the `StoragePath` string corresponding to the indicated revision
   * number, specifically to store the caret change that results in that
   * revision.
   *
   * @param {RevisionNumber} revNum The revision number.
   * @returns {string} The corresponding `StoragePath` string for caret change
   *   storage.
   */
  static forCaretChange(revNum) {
    RevisionNumber.check(revNum);
    return `${Paths.CARET_CHANGE_PREFIX}/${revNum}`;
  }

  /**
   * Gets the `StoragePath` string corresponding to the indicated revision
   * number, specifically to store the property data change that results in that
   * revision.
   *
   * @param {RevisionNumber} revNum The revision number.
   * @returns {string} The corresponding `StoragePath` string for property
   *   change storage.
   */
  static forPropertyChange(revNum) {
    RevisionNumber.check(revNum);
    return `${Paths.PROPERTY_CHANGE_PREFIX}/${revNum}`;
  }
}
