// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Hooks } from 'hooks-server';
import { Errors, Singleton } from 'util-common';


/**
 * Various filesystem directories.
 */
export default class Dirs extends Singleton {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /** {string} Base directory of the product. */
    this._baseDir = Dirs._findBaseDir();

    /** {string} "Var" directory to use. */
    this._varDir = Dirs._findAndEnsureVarDir(this._baseDir);

    Object.freeze(this);
  }

  /**
   * The base directory for the product. This is where the code lives, as well
   * as working files when running in development mode.
   */
  get BASE_DIR() {
    return this._baseDir;
  }

  /**
   * The client directory. This contains both code and assets.
   */
  get CLIENT_DIR() {
    return path.resolve(this.BASE_DIR, 'client');
  }

  /**
   * The client code directory.
   */
  get CLIENT_CODE_DIR() {
    return path.resolve(this.BASE_DIR, 'client/js');
  }

  /**
   * The directory to write log files to. Accessing this value guarantees the
   * existence of the directory (that is, it will create the directory if
   * necessary).
   */
  get LOG_DIR() {
    const result = path.resolve(this.VAR_DIR, 'log');

    Dirs._ensureDir(result);
    return result;
  }

  /**
   * The server directory. This contains the server code.
   */
  get SERVER_DIR() {
    return path.resolve(this.BASE_DIR, 'server');
  }

  /**
   * The "var" (mutable/variable data) directory. This is where local data is
   * kept. Accessing this value guarantees the existence of the directory (that
   * is, it will create the directory if necessary).
   */
  get VAR_DIR() {
    return this._varDir;
  }

  /**
   * Figures out where the base directory is. This walks up from the directory
   * where this module is stored, looking for a directory that contains the file
   * `product-info.txt`.
   *
   * @returns {string} The base directory path.
   */
  static _findBaseDir() {
    let dir = __dirname;

    for (;;) {
      if ((dir === '.') || (dir === '/')) {
        throw Errors.badUse(`Unable to determine base product directory, starting from: ${__dirname}`);
      }

      try {
        const stat = fs.statSync(path.resolve(dir, 'product-info.txt'));
        if (stat.isFile()) {
          return dir;
        }
      } catch (e) {
        // Presumably not found. Ignore the exception, fall through, and
        // iterate.
      }

      dir = path.dirname(dir);
    }
  }

  /**
   * Figures out where the "var" directory is, by deferring to the salient hook.
   * In addition, creates the directory if it doesn't already exist.
   *
   * @param {string} baseDir The product base directory.
   * @returns {string} The "var" directory.
   */
  static _findAndEnsureVarDir(baseDir) {
    const result = Hooks.theOne.findVarDirectory(baseDir);

    Dirs._ensureDir(result);
    return result;
  }

  /**
   * Guarantees that a directory exists. Creates it if it doesn't exist. If the
   * path exists but isn't a directory, throws an error.
   *
   * @param {string} dirPath Path to the (alleged or to-be-created) directory.
   */
  static _ensureDir(dirPath) {
    try {
      const stat = fs.statSync(dirPath);
      if (stat.isDirectory()) {
        return;
      } else {
        throw Errors.badUse(`Expected a directory: ${dirPath}`);
      }
    } catch (e) {
      // Presumably not found. Ignore the exception, fall through, and attempt
      // to create it.
    }

    fs.mkdirSync(dirPath);
  }
}
