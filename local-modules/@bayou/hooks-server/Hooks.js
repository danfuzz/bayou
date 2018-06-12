// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

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
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after logging has
   * been initialized but before almost everything else.
   */
  async run() {
    // This space intentionally left blank.
  }
}
