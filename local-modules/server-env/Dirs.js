// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

/** {string|null} Base directory of the product. Set up by `init()`. */
let baseDir = null;


/**
 * Various filesystem directories.
 */
export default class Dirs {
  /**
   * Initializes this class. This is not meant to be called publicly (though it
   * is innocuous if done so).
   */
  static init() {
    if (baseDir !== null) {
      // Already initialized.
      return;
    }

    baseDir = Dirs._findBaseDir();
  }

  /**
   * The base directory for the product. This is where the code lives, as well
   * as working files when running in development mode.
   */
  static get BASE_DIR() {
    Dirs.init();
    return baseDir;
  }

  /**
   * The client directory. This contains both code and assets.
   */
  static get CLIENT_DIR() {
    return path.resolve(Dirs.BASE_DIR, 'client');
  }

  /**
   * The client code directory.
   */
  static get CLIENT_CODE_DIR() {
    return path.resolve(Dirs.BASE_DIR, 'client/js');
  }

  /**
   * The directory to write log files to.
   */
  static get LOG_DIR() {
    return path.resolve(Dirs.VAR_DIR, 'log');
  }

  /**
   * The server directory. This contains the server code.
   */
  static get SERVER_DIR() {
    return path.resolve(Dirs.BASE_DIR, 'server');
  }

  /**
   * The "var" (mutable/variable data) directory. This is where local data is
   * kept.
   */
  static get VAR_DIR() {
    // TODO: In production, this will want to be somewhere other than under the
    // product deployment base directory. This might reasonably be configured
    // via an item in `hooks-server`.
    const result = path.resolve(Dirs.BASE_DIR, 'var');

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
   * Figures out where the base directory is. This walks up from the directory
   * where this module is stored, looking for a directory that contains a
   * `local-modules` directory.
   *
   * @returns {string} The base directory path.
   */
  static _findBaseDir() {
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
}
