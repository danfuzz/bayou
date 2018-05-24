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

import { ClientEnv } from '@bayou/env-client';
import { Logger } from '@bayou/see-all';
import { ClientSink } from '@bayou/see-all-client';

import TopControl from './TopControl';

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
