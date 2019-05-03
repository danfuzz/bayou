// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the network configuration of a server.
 */
export class Network extends UtilityClass {
  /**
   * {string} The base URL to use when constructing URLs to point at the
   * public-facing (set of) machine(s) which front for this server.
   */
  static get baseUrl() {
    return use.Network.baseUrl;
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
   * {string} The URL origin to use for loopback requests to this instance from
   * the machine it is running on. This is typically configured to be
   * `http://localhost:${Network.listenPort}` though some configurations may
   * need to be less trivial.
   */
  static get loopbackUrl() {
    return use.Network.loopbackUrl;
  }

  /**
   * {Int|null} The local port to use for internal monitoring, or `null` to
   * not expose monitoring endpoints.
   */
  static get monitorPort() {
    return use.Network.monitorPort;
  }
}
