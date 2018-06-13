// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization.
 *
 * This file is directly loaded from pages that include an editor. See
 * {@link @bayou/top-client/TopControl} for details about how bootstrap
 * parameters get passed into the system.
 */

import { injectAll } from '@bayou/config-common-default';
import { Client } from '@bayou/top-client';

Client.run(injectAll);
