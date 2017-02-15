// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import Proppy from 'proppy';

import PidFile from './PidFile';

/** Base directory of the product. */
const BASE_DIR = findBaseDir();

/** Product info object. */
const PRODUCT_INFO = Proppy.parseFile(path.resolve(BASE_DIR, 'product-info.txt'));

/**
 * Figure out where the base directory is. This walks up from the directory
 * where this module is stored, looking for a directory that contains a
 * `local-modules` directory.
 *
 * @returns {string} The base directory path.
 */
function findBaseDir() {
  let dir = __dirname;

  for (;;) {
    if ((dir === '.') || (dir === '/')) {
      throw new Error(`Unable to determine base product directory, starting from: ${__dirname}`);
    }

    try {
      const stat = fs.statSync(path.resolve(dir, 'local-modules'));
      if (stat.isDirectory()) {
        return dir;
      }
    } catch (e) {
      // Presumably not found. Ignore the exception, fall through, and iterate.
    }

    dir = path.dirname(dir);
  }
}

/**
 * Miscellaneous server-side utilities.
 */
export default class ServerUtil {
  /**
   * The base directory for the product. This is where the code lives, as well
   * as working files when running in development mode.
   */
  static get BASE_DIR() {
    return BASE_DIR;
  }

  /**
   * The client directory. This contains both code and assets.
   */
  static get CLIENT_DIR() {
    return path.resolve(BASE_DIR, 'client');
  }

  /**
   * The client code directory.
   */
  static get CLIENT_CODE_DIR() {
    return path.resolve(BASE_DIR, 'client/js');
  }

  /**
   * The product info object, as parsed from `product-info.txt`.
   */
  static get PRODUCT_INFO() {
    return PRODUCT_INFO;
  }

  /**
   * The server directory. This contains just code.
   */
  static get SERVER_DIR() {
    return path.resolve(BASE_DIR, 'server');
  }

  /**
   * The "var" (mutable/variable data) directory. This is where local data is
   * kept.
   */
  static get VAR_DIR() {
    // TODO: In production, this will want to be somewhere other than under the
    // product deployment base directory. This might reasonably be configured
    // via an item in `server-hooks`.
    const result = path.resolve(BASE_DIR, 'var');

    try {
      const stat = fs.statSync(result);
      if (stat.isDirectory()) {
        return result;
      } else {
        throw new Error(`Expected a directory: ${result}`);
      }
    } catch (e) {
      // Presumably not found. Ignore the exception, fall through, and attempt
      // to create it.
    }

    fs.mkdirSync(result);
    return result;
  }

  /**
   * Write the PID (process ID) file for the current running process, and
   * arrange for it to be removed on process exit.
   */
  static initPidFile() {
    PidFile.init(BASE_DIR);
  }
}
