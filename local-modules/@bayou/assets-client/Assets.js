// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { UtilityClass } from '@bayou/util-common';

/** {string} Absolute path to the `files` directory. */
const DIR = path.resolve(__dirname, 'files');

/**
 * Default provider of static assets to serve to clients.
 */
export class Assets extends UtilityClass {
  /**
   * {array<string>} Default implementation of the configuration
   * {@link @bayou/config-server/Deployment#ASSET_DIRS}, which refers _just_ to
   * the static assets within this module.
   */
  static get DIRS() {
    return [DIR];
  }
}
