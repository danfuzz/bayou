// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Dirs from './Dirs';
import PidFile from './PidFile';
import ProductInfo from './ProductInfo';

/**
 * Miscellaneous server-side utilities.
 */
export default class ServerEnv {
  /**
   * Initializes this module. This sets up the info for the `Dirs` class, sets
   * up the PID file, and gathers the product metainfo.
   */
  static init() {
    Dirs.theOne;
    PidFile.theOne;
    ProductInfo.theOne;
  }
}
