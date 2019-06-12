// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { collectDefaultMetrics, register, Counter } from 'prom-client';

import { ServerEnv } from '@bayou/env-server';
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

    // **Note:** OpenMetrics seems to prefer `lower_camel_case` names.
    const prefix = `${ServerEnv.theOne.buildInfo.name}_`;

    /** {string} Prefix to use for metrics names. */
    this._prefix = prefix;

    /**
     * {Counter} Counter for total HTTP requests which elicited regular HTTP
     * responses. (This won't capture websocket requests.)
     */
    this._requestsTotal = new Counter({
      name:       `${prefix}requests_total`,
      help:       'Counter of HTTP requests, with method and status code labels',
      labelNames: ['method', 'code'],
    });

    collectDefaultMetrics({ prefix });

    Object.freeze(this);
  }

  /**
   * {function} Express middleware which hooks up the {@link #_requestsTotal}
   * counter.
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
