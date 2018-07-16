// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Network } from '@bayou/config-server';
import { CommonBase } from '@bayou/util-common';


/**
 * "Variable" info (like, it varies and isn't just static to the system), which
 * is provided via the internal monitoring server (see {@link Monitor}).
 */
export default class VarInfo extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    Object.freeze(this);
  }

  /**
   * Gets the latest variable info.
   *
   * @returns {object} A JSON-encodable object with all of the variable info.
   */
  async get() {
    // **Note:** The "printable" form of a bearer token is redacted, such that
    // the secret portion is not represented.
    const tokenIds = Network.bearerTokens.rootTokens.map(t => t.printableId);

    return {
      pid:        process.pid,
      rootTokens: tokenIds
    };
  }
}
