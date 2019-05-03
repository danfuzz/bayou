// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility class that just provides the common `StoragePath` strings used
 * by the document storage format.
 */
export class Paths extends UtilityClass {
  /**
   * {string} `StoragePath` prefix string for document body (main content)
   * information.
   */
  static get BODY_PREFIX() {
    return '/body';
  }

  /** {string} `StoragePath` prefix string for caret information. */
  static get CARET_PREFIX() {
    return '/caret';
  }

  /**
   * {string} `StoragePath` prefix string for property (metadata) information.
   */
  static get PROPERTY_PREFIX() {
    return '/prop';
  }

  /** {string} `StoragePath` string for the file schema (format) version. */
  static get SCHEMA_VERSION() {
    return '/schema_version';
  }
}
