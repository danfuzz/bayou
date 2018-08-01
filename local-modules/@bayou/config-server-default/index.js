// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inject } from '@bayou/injecty';

import Deployment from './Deployment';
import Logging from './Logging';
import Network from './Network';
import Storage from './Storage';

/**
 * Injects all of the definitions here into the global configuration.
 */
function injectAll() {
  inject.Deployment = Deployment;
  inject.Logging    = Logging;
  inject.Network    = Network;
  inject.Storage    = Storage;
}

export {
  Deployment,
  Logging,
  Network,
  Storage,
  injectAll
};
