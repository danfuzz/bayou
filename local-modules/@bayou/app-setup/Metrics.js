// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { collectDefaultMetrics, register, Counter, Gauge } from 'prom-client';

import { ServerEnv } from '@bayou/env-server';
import { TInt } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * Prometheus- / OpenMetrics-based metrics collection and reporting.
 */
export class Metrics extends CommonBase {
  /**
   * Constructs an instance. This also sets up default metrics collection. (As
   * such, the latter bit means that it's probably a bad idea to instantiate
   * this class more than once per process.)
   */
  constructor() {
    super();

    const buildInfo = ServerEnv.theOne.buildInfo;

    // **Note:** OpenMetrics seems to prefer `lower_camel_case` names.
    const prefix = `${buildInfo.name}_`;

    /** {string} Prefix to use for metrics names. */
    this._prefix = prefix;

    /**
     * {Counter} Counter for total HTTP requests which elicited regular HTTP
     * responses. (This won't capture websocket requests.)
     */
    this._requestsTotal = new Counter({
      name:       `${prefix}http_requests_total`,
      help:       'Counter of normal HTTP requests, with method and status code labels',
      labelNames: ['method', 'code'],
    });

    /** {Counter} Counter for total number of initiated API connections. */
    this._connectionCountTotal = new Counter({
      name: `${prefix}api_connections_total`,
      help: 'Counter of API connection initiations'
    });

    /** {Gauge} Gauge of number of currently-active API connections. */
    this._connectionCountNow = new Gauge({
      name: `${prefix}api_connections_now`,
      help: 'Gauge of currently-active API connections'
    });

    /** {Gauge} Gauge of the current load factor. */
    this._loadFactor = new Gauge({
      name: `${prefix}load_factor`,
      help: 'Gauge of current load factor'
    });

    /**
     * {Gauge} Pseudo-gauge whose labels identify the currently-running build.
     */
    this._buildInfo = new Gauge({
      name:       `${prefix}build_info`,
      help:       'What build is running',
      labelNames: ['buildDate', 'buildId', 'buildNumber'],
    });
    const buildInfoLabels = {
      buildDate:   buildInfo.buildDate,
      buildId:     buildInfo.buildId,
      buildNumber: buildInfo.buildNumber
    };
    this._buildInfo.set(buildInfoLabels, 1);

    collectDefaultMetrics({ prefix });

    Object.freeze(this);
  }

  /**
   * Updates the API-connection-related metrics.
   *
   * @param {Int} connectionCountNow How many active API connections there are
   *   right now.
   * @param {Int} connectionCountTotal How many API connections this server has
   *   ever handled.
   */
  apiMetrics(connectionCountNow, connectionCountTotal) {
    TInt.check(connectionCountNow);
    TInt.check(connectionCountTotal);

    this._connectionCountNow.set(connectionCountNow);

    // There's no `set()` method on `Counter`; the best we can do is sniff the
    // value and `inc()` it to what we want.

    const lastTotal = this._connectionCountTotal.get().values[0].value || 0;
    const diff      = connectionCountTotal - lastTotal;

    if (diff > 0) {
      this._connectionCountTotal.inc(diff);
    }
  }

  /**
   * Updates the load factor metric.
   *
   * @param {Int} loadFactor Current load factor.
   */
  loadFactor(loadFactor) {
    TInt.check(loadFactor);

    this._loadFactor.set(loadFactor);
  }

  /**
   * {function} Express middleware which hooks up the HTTP-request-related
   * metrics.
   */
  get httpRequestMiddleware() {
    return (req, res, next) => {
      res.on('finish', () => {
        this._requestsTotal.labels(req.method, res.statusCode).inc();
      });
      next();
    };
  }

  /**
   * {prom-client.client.Registry} The registry used by this instance.
   *
   * **Note:** As of this writing, it is always the default (global) metrics
   * registry. It is an instance property (not `static`) for consistency with
   * the rest of the class and on the assumption that we will want to stop using
   * the global registry at some point (especially so as to aid in testing).
   */
  get register() {
    return register;
  }
}
