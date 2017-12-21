// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TheModule as ApiCommon_TheModule } from 'api-common';
import { Codec, Registry } from 'codec';
import { TheModule as DocCommon_TheModule } from 'doc-common';
import { TheModule as OtCommon_TheModule } from 'ot-common';
import { UtilityClass } from 'util-common';

/**
 * Utilities for this module.
 */
export default class TheModule extends UtilityClass {
  /**
   * {Codec} Standard {@link Codec} instance, constructed by
   * {@link #makeFullCodec}.
   */
  static get fullCodec() {
    if (!this._fullCodec) {
      this._fullCodec = this.makeFullCodec();
    }

    return this._fullCodec;
  }

  /**
   * {Codec} Standard {@link Codec} instance, constructed by
   * {@link #makeModelCodec}.
   */
  static get modelCodec() {
    if (!this._modelCodec) {
      this._modelCodec = this.makeModelCodec();
    }

    return this._ModelCodec;
  }

  /**
   * Constructs a {@link Codec} which is configured for representation of all
   * application model values as well as API transport objects.
   *
   * @returns {Codec} An appropriately-configured {@link Codec} instance.
   */
  static makeFullCodec() {
    const registry = new Registry();

    ApiCommon_TheModule.registerCodecs(registry);
    DocCommon_TheModule.registerCodecs(registry);
    OtCommon_TheModule.registerCodecs(registry);

    return new Codec(registry);
  }

  /**
   * Constructs a {@link Codec} which is configured for representation of all
   * application model values (and nothing else).
   *
   * @returns {Codec} An appropriately-configured {@link Codec} instance.
   */
  static makeModelCodec() {
    const registry = new Registry();

    DocCommon_TheModule.registerCodecs(registry);
    OtCommon_TheModule.registerCodecs(registry);

    return new Codec(registry);
  }
}
