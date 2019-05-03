// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding text handling.
 */
export class Text extends UtilityClass {
  /**
   * {Delta} Implementation of standard configuration point. See `package.json`
   * in this directory for details of the version we return here.
   */
  static get Delta() {
    return Delta;
  }
}
