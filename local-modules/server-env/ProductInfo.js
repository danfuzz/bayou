// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { Proppy } from 'proppy';

import Dirs from './Dirs';

/** {object|null} Product info object. Set up by `init()`. */
let productInfo = null;


/**
 * Product metainformation.
 */
export default class ProductInfo {
  /**
   * Initializes this class. This is not meant to be called publicly (though it
   * is innocuous if done so).
   */
  static init() {
    if (productInfo !== null) {
      // Already initialized.
      return;
    }

    productInfo = Proppy.parseFile(
      path.resolve(Dirs.theOne.BASE_DIR, 'product-info.txt'));
  }

  /**
   * The product info object, as parsed from `product-info.txt`.
   */
  static get INFO() {
    return productInfo;
  }
}
