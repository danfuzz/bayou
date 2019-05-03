// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Base class for {@link Auth} (in this module) and its configured
 * implementations. This isn't much of a real base class, so much as a
 * reasonable way to define constants needed by the configured implementations
 * and the clients of this configuration.
 */
export class BaseAuth extends UtilityClass {
  /** {string} Constant used by {@link Auth#tokenAuthority} (see which). */
  static get TYPE_author() { return 'author'; }

  /** {string} Constant used by {@link Auth#tokenAuthority} (see which). */
  static get TYPE_none() { return 'none'; }

  /** {string} Constant used by {@link Auth#tokenAuthority} (see which). */
  static get TYPE_root() { return 'root'; }
}
