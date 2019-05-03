// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding text handling.
 */
export class Text extends UtilityClass {
  /**
   * {Delta} The class to use for text "delta" (document and change
   * representation) functionality. The interface of this class is expected to
   * be compatible with `Delta` as defined by the Quill project.
   */
  static get Delta() {
    return use.Text.Delta;
  }
}
