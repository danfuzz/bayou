// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the network configuration of a server.
 */
export default class Network extends UtilityClass {
  /**
   * {string} The base URL to use when constructing URLs to point at the
   * public-facing (set of) machine(s) which front for this server.
   */
  static get baseUrl() {
    return use.Network.baseUrl;
  }

  /**
   * {BearerTokens} The object which validates and authorizes bearer tokens.
   * See that (base / default) class for details.
   */
  static get bearerTokens() {
    return use.Network.bearerTokens;
  }

  /**
   * {array<string>} An array of at least two example token strings, each of
   * which is syntactically valid but should _not_ actually grant access to
   * anything in a production environment. This is intended for unit testing.
   */
  static get exampleTokens() {
    return use.Network.exampleTokens;
  }

  /**
   * {Int} The local port to listen for connections on.
   *
   * **Note:** This can get overridden when running the system for the purposes
   * of unit testing, so it isn't safe to rely on it to always reflect what's
   * running.
   */
  static get listenPort() {
    return use.Network.listenPort;
  }

  /**
   * {Int|null} The local port to use for internal monitoring, or `null` to
   * not expose monitoring endpoints.
   */
  static get monitorPort() {
    return use.Network.monitorPort;
  }
}
