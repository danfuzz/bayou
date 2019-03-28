// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { collectDefaultMetrics, register, Counter } from 'prom-client';

collectDefaultMetrics({ prefix: 'docs_' });

const RequestsTotal = new Counter({
  name: 'docs_requests_total',
  help: 'counter recording request metadata',
  labelNames: ['method', 'code'],
});

export function MetricsMiddleware(req, res, next) {
  next();
  RequestsTotal.labels(req.method, res.statusCode).inc();
}

export { register, RequestsTotal };
