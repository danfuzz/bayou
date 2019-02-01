// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase } from 'lodash';
import path from 'path';

import { Proppy } from '@bayou/proppy';
import { Singleton } from '@bayou/util-common';

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

    // Parse the info file and convert keys to `camelCase` for consistency with
    // how other things tend to be named in this system.
    const origInfo = Proppy.parseFile(path.resolve(Dirs.theOne.BASE_DIR, 'product-info.txt'));
    const info     = {};

    for (const [key, value] of Object.entries(origInfo)) {
      info[camelCase(key)] = value;
    }

    /** {object} Product info object. */
    this._productInfo = Object.freeze(info);
  }

  /**
   * The product info object, as parsed from `product-info.txt`.
   */
  get INFO() {
    return this._productInfo;
  }
}
