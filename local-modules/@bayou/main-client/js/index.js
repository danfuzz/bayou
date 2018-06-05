// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. See {@link
 * TopControl} for info on how bootstrap parameters get passed into the
 * system.
 */

import { injectAll } from '@bayou/default-config-common';
import { ClientEnv } from '@bayou/env-client';
import { Logger } from '@bayou/see-all';
import { ClientSink } from '@bayou/see-all-client';

import TopControl from './TopControl';

// Inject all the system configs. **TODO:** Consider whether the rest of the
// code in this module ought to be reusable by other client `main` modules. If
// so, then the other code in this module probably ought to move to a different
// module (which could then be imported by both this one and that would-be other
// client `main`). That would leave this call -- performing default
// configuration -- in this module, and not really much else!
injectAll();

// Init logging.
ClientSink.init();
const log = new Logger('page-init');
log.detail('Starting...');

// Init the environment utilities.
ClientEnv.init(window);

const control = new TopControl(window);
log.detail('Made `control`.');

control.start();
log.detail('Done with outer init.');
