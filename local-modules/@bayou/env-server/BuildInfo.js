// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase } from 'lodash';
import path from 'path';

import { Proppy } from '@bayou/proppy';
import { CommonBase } from '@bayou/util-common';

import Dirs from './Dirs';


/**
 * Build / product metainformation. This is information about the built product
 * artifact, explicitly stored as a file at the top level of the product
 * artifact directory.
 */
export default class BuildInfo extends CommonBase {
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

    info.buildId = BuildInfo._makeBuildIdString(info);

    /** {object} Info object. */
    this._info = Object.freeze(info);
  }

  /**
   * {object} The info object, as parsed from the build / product
   * metainformation file.
   */
  get info() {
    return this._info;
  }

  /**
   * Makes the build ID string to include in the info (and which, for example,
   * gets reported in HTTP response headers).
   *
   * @param {object} info The basic product info.
   * @returns {string} The build ID string.
   */
  static _makeBuildIdString(info) {
    const { buildNumber, commitId, name, version } = info;

    const id = ((typeof commitId === 'string') && (commitId !== '') && (commitId !== 'unknown'))
      ? `-${commitId.slice(0, 8)}`
      : '';

    const num = ((typeof buildNumber === 'string') && /^[0-9]+$/.test(buildNumber))
      ? `-${buildNumber}`
      : '';

    return `${name}-${version}${num}${id}`;
  }
}
