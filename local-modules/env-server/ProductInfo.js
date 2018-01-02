// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { Proppy } from 'proppy';
import { Singleton } from 'util-common';

import Dirs from './Dirs';


/**
 * Product metainformation.
 */
export default class ProductInfo extends Singleton {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /** {object} Product info object. */
    this._productInfo = Proppy.parseFile(
      path.resolve(Dirs.theOne.BASE_DIR, 'product-info.txt'));
  }

  /**
   * The product info object, as parsed from `product-info.txt`.
   */
  get INFO() {
    return this._productInfo;
  }
}
