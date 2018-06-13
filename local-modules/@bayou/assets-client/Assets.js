// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { UtilityClass } from '@bayou/util-common';

/** {string} Absolute path to the `files` directory. */
const BASE_DIR = path.resolve(__dirname, 'files');

/**
 * Provider of static assets to serve to clients.
 */
export default class Assets extends UtilityClass {
  /**
   * {string} Absolute filesystem path to the base asset directory. All files
   * under this directory are expected to be servable to clients; that is, there
   * should be no server-private files under that directory.
   */
  static get BASE_DIR() {
    return BASE_DIR;
  }
}
