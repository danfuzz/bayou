// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codecs as apiCommon_TheModule } from '@bayou/api-common';
import { Codec, Registry } from '@bayou/codec';
import { Codecs as docCommon_TheModule } from '@bayou/doc-common';
import { Codecs as otCommon_TheModule } from '@bayou/ot-common';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utilities for this module.
 */
export class Codecs extends UtilityClass {
  /**
   * {Codec} Standard {@link Codec} instance, constructed by
   * {@link #makeFullCodec}.
   */
  static get fullCodec() {
    if (!this._fullCodec) {
      this._fullCodec = this.makeFullCodec();
      this._fullCodec.registry.freeze();
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
      this._modelCodec.registry.freeze();
    }

    return this._modelCodec;
  }

  /**
   * Constructs a {@link Codec} which is configured for representation of all
   * application model values as well as API transport objects.
   *
   * @returns {Codec} An appropriately-configured {@link Codec} instance.
   */
  static makeFullCodec() {
    const registry = new Registry();

    apiCommon_TheModule.registerCodecs(registry);
    docCommon_TheModule.registerCodecs(registry);
    otCommon_TheModule.registerCodecs(registry);

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

    docCommon_TheModule.registerCodecs(registry);
    otCommon_TheModule.registerCodecs(registry);

    return new Codec(registry);
  }
}
