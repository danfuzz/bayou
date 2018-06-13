// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Top-level entry point for client tests.
 */

import { injectAll } from '@bayou/config-common-default';
import { Tests } from '@bayou/testing-client';
import { Client } from '@bayou/top-client';

Client.runUnitTests(injectAll, Tests);
