#!/usr/bin/env node
// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Common_injectAll } from '@bayou/config-common-default';
import { Server_injectAll } from '@bayou/config-server-default';
import { Server } from '@bayou/server-top';

function injectAll() {
  Common_injectAll();
  Server_injectAll();
}

Server.runAndExit(process.argv, injectAll);
