// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { LocalDocStore } from 'doc-store-local';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks {
  /**
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after the very
   * basic initialization but before any document-handling code has been
   * initialized or run.
   */
  static run() {
    // This space intentionally left blank.
  }

  /**
   * {string} The base URL for accessing this server. The default value is
   * is `http://localhost:8080`.
   */
  static get baseUrl() {
    return 'http://localhost:8080';
  }

  /**
   * The object which provides access to document storage. This is an instance
   * of a subclass of `BaseDocStore`, as defined by the `doc-store` module.
   */
  static get docStore() {
    return LocalDocStore.THE_INSTANCE;
  }

  /**
   * The object which validates root credentials. These are credentials which
   * provide "root" access to the server.
   */
  static get rootValidator() {
    // By default, we provide a no-op implementation. TODO: Should probably
    // provide a non-no-op default.
    return {
      checkCredential: ((cred_unused) => { return true; })
    };
  }
}
