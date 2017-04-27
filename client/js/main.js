// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. It expects
 * there to be a DOM node tagged with id `editor`.
 */

import { Logger } from 'see-all';
import { SeeAllBrowser } from 'see-all-browser';

import TopControl from './TopControl';

// Init logging.
SeeAllBrowser.init();
const log = new Logger('page-init');
log.detail('Starting...');

const control = new TopControl(window);
log.detail('Made `control`.');

control.start();
log.detail('Done with outer init.');
