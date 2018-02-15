// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { LocalFileStore } from 'file-store-local';
import { Hooks as hooksCommon_Hooks } from 'hooks-common';
import { Singleton } from 'util-common';

import BearerTokens from './BearerTokens';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * {string} The base URL to use when constructing URLs to point at the
   * public-facing (set of) machine(s) which front for this server.
   *
   * The default value for this is `http://localhost:N` where `N` is the value
   * of {@link #listenPort}.
   */
  get baseUrl() {
    return `http://localhost:${this.listenPort}`;
  }

  /**
   * {BearerTokens} The object which validates and authorizes bearer tokens.
   * See that (base / default) class for details.
   */
  get bearerTokens() {
    return BearerTokens.theOne;
  }

  /**
   * {BaseFileStore} The object which provides access to file storage (roughly
   * speaking, the filesystem to store the "files" this system deals with). This
   * is an instance of a subclass of `BaseFileStore`, as defined by the
   * `file-store` module.
   */
  get fileStore() {
    return LocalFileStore.theOne;
  }

  /**
   * {Int} The local port to listen for connections on by default. This
   * typically but does not _necessarily_ match the values returned by
   * {@link #baseUrl}. It won't match in cases where this server runs behind a
   * reverse proxy, for example. It also won't match when the system is brought
   * up in `test` mode, as that mode will pick an arbitrary port to listen on.
   *
   * This (default) implementation of the property always returns `8080`.
   */
  get listenPort() {
    return 8080;
  }

  /**
   * {Int|null} The local port to use for internal monitoring, or `null` to
   * not expose monitoring endpoints.
   *
   * This (default) implementation of the property always returns `8888`.
   */
  get monitorPort() {
    return 8888;
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
    return hooksCommon_Hooks.theOne.isDocumentId(id);
  }

  /**
   * Checks to see if this server is running in a "development" environment,
   * returning an indication of the fact. A development environment is notable
   * in that it notices when source files change (and acts accordingly), has
   * `/debug` endpoints enabled, and may be less secure in other ways as a
   * tradeoff for higher internal visibility, that is, higher debugability.
   *
   * The default implementation of this method always returns `true`.
   *
   * @returns {boolean} `true` if this server is running in a development
   *   environment, or `false` if not.
   */
  isRunningInDevelopment() {
    return true;
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
