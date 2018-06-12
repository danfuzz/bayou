// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { LocalFileStore } from '@bayou/file-store-local';
import { Singleton } from '@bayou/util-common';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();
  }

  /**
   * {BaseFileStore} The object which provides access to file storage (roughly
   * speaking, the filesystem to store the "files" this system deals with). This
   * is an instance of a subclass of `BaseFileStore`, as defined by the
   * `@bayou/file-store` module.
   */
  get fileStore() {
    return LocalFileStore.theOne;
  }

  /**
   * Determines the location of the "var" (variable / mutable data) directory,
   * returning an absolute path to it. (This is where, for example, log files
   * are stored.) The directory need not exist; the system will take care of
   * creating it as needed.
   *
   * The default implementation (here) returns the base product directory (the
   * argument), with `/var` appended. It's expected that in a production
   * environment, it will be common to return an unrelated filesystem path
   * (because, e.g., the base product directory is recursively read-only).
   *
   * @param {string} baseDir The base product directory.
   * @returns {string} Absolute filesystem path to the "var" directory to use.
   */
  findVarDirectory(baseDir) {
    return path.join(baseDir, 'var');
  }

  /**
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after logging has
   * been initialized but before almost everything else.
   */
  async run() {
    // This space intentionally left blank.
  }
}
