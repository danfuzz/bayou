// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { LocalContentStore } from 'file-store-local';
import { Hooks as HooksCommon } from 'hooks-common';
import { Singleton } from 'util-common';

import BearerTokens from './BearerTokens';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after the very
   * basic initialization but before any document-handling code has been
   * initialized or run.
   */
  run() {
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
  baseUrlFromRequest(req) {
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
  get bearerTokens() {
    return BearerTokens.theOne;
  }

  /**
   * The object which provides access to content storage. This is an instance
   * of a subclass of `BaseFileStore`, as defined by the `file-store`
   * module.
   */
  get contentStore() {
    return LocalContentStore.theOne;
  }

  /**
   * Checks whether the given value is syntactically valid as a file ID.
   * This method is only ever called with a non-empty string.
   *
   * The default implementation of this method is to defer to the hook
   * `hooks-common.Hooks.theOne.isDocumentId()`.
   *
   * @param {string} id The (alleged) file ID to check.
   * @returns {boolen} `true` iff `id` is syntactically valid.
   */
  isFileId(id) {
    return HooksCommon.theOne.isDocumentId(id);
  }

  /**
   * {Int} The local port to listen for connections on. The default value is
   * `8080`. In general, this often but does not necessarily match the value
   * in `baseUrl`. It won't match in cases where this server runs behind a
   * reverse proxy, for example.
   */
  get listenPort() {
    return 8080;
  }
}
