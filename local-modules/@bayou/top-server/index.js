// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` patches Node's stack trace generator so as to make it respect
// source maps (and so produce traces with proper source position info for
// compiled files). We do this as the very first thing upon running, so that
// any exceptions thrown during bootstrap have a reasonable chance of getting
// displayed with an accurate backtrace.
import 'source-map-support/register';

// Theis `import` completes the setup of the Babel runtime.
import 'babel-polyfill';

import { Action } from './Action';
import { Options } from './Options';
import { Server } from './Server';
import { TopErrorHandler } from './TopErrorHandler';

export { Action, Options, Server, TopErrorHandler };
