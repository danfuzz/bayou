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
   * {object} The object which validates bearer tokens. See
   * `api-client.BearerToken` for details. This object must implement two
   * methods:
   *
   * * `isToken(token)` -- Returns `true` if the `token` is _syntactically_
   *   valid (whether or not it actually grants any access). This will only ever
   *   get called on strings (per se) of at least 32 characters, so it is safe
   *   to assume those facts. The default implementation just returns `true`.
   * * `tokenId(token)` -- Returns the portion of `token` which should be
   *   considered its "ID" for the purposes of lookup, logging, etc. The default
   *   implementation just returns the first 16 characters of the token.
   */
  static get bearerTokenValidator() {
    return {
      isToken: ((token_unused) => {
        return true;
      }),
      tokenId: ((token) => {
        return token.slice(0, 16);
      })
    };
  }

  /**
   * The object which provides access to document storage. This is an instance
   * of a subclass of `BaseDocStore`, as defined by the `doc-store` module.
   */
  static get docStore() {
    return LocalDocStore.THE_INSTANCE;
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

  /**
   * {object} The object which validates root credentials. These are credentials
   * which provide "root" access to the server. This object must implement two
   * methods:
   *
   * * `checkCredential(cred)` -- Returns `true` if the `cred` is valid and
   *    grants root access, or `false` if not.
   * * `isCredential(cred)` -- Returns `true` if the `cred` is _syntactically_
   *   valid (whether or not it actually grants root access).
   */
  static get rootValidator() {
    // By default, we provide a very simple and obviously insecure default,
    // which just checks to see if the given credential is the literal string
    // `root`. TODO: Should probably provide a less trivial default.

    return {
      isCredential:    ((cred) => { return (typeof cred) === 'string'; }),
      checkCredential: ((cred) => { return cred === 'root'; })
    };
  }
}
