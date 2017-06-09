// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { LocalDocStore } from 'content-store-local';

import BearerTokens from './BearerTokens';

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
   * Given an HTTP request, returns the "public" base URL of that request.
   * By default this is just the `host` as indicated in the headers, prefixed
   * by `http://`. However, when deployed behind a reverse proxy, the
   * public-facing base URL could turn out to be different, hence this hook.
   *
   * @param {object} req HTTP request object.
   * @returns {string} The base URL.
   */
  static baseUrlFromRequest(req) {
    const host = req.headers.host;
    if (host) {
      return `http://${host}`;
    }

    throw new Error('Missing `host` header on request.');
  }

  /**
   * {BearerTokens} The object which validates and authorizes bearer tokens.
   * See that (base / default) class for details.
   */
  static get bearerTokens() {
    return BearerTokens.theOne;
  }

  /**
   * The object which provides access to document storage. This is an instance
   * of a subclass of `BaseDocStore`, as defined by the `content-store` module.
   */
  static get docStore() {
    return LocalDocStore.theOne;
  }

  /**
   * {Int} The local port to listen for connections on. The default value is
   * `8080`. In general, this often but does not necessarily match the value
   * in `baseUrl`. It won't match in cases where this server runs behind a
   * reverse proxy, for example.
   */
  static get listenPort() {
    return 8080;
  }
}
