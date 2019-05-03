// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inject } from '@bayou/injecty';

import { Auth } from './Auth';
import { Deployment } from './Deployment';
import { HtmlExport } from './HtmlExport';
import { Logging } from './Logging';
import { Network } from './Network';
import { Storage } from './Storage';

/**
 * Injects all of the definitions here into the global configuration.
 */
function injectAll() {
  inject.Auth       = Auth;
  inject.Deployment = Deployment;
  inject.HtmlExport = HtmlExport;
  inject.Logging    = Logging;
  inject.Network    = Network;
  inject.Storage    = Storage;
}

export {
  Auth,
  Deployment,
  HtmlExport,
  Logging,
  Network,
  Storage,
  injectAll
};
