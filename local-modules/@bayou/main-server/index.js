#!/usr/bin/env node
// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { injectAll as common_injectAll } from '@bayou/config-common-default';
import { injectAll as server_injectAll } from '@bayou/config-server-default';
import { Server } from '@bayou/top-server';

function injectAll() {
  common_injectAll();
  server_injectAll();
}

Server.runAndExit(process.argv, injectAll);
