// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { AllConfigs } from './AllConfigs';
import { InjectHandler } from './InjectHandler';
import { UseHandler } from './UseHandler';

/**
 * Provider of injected objects and values, as properties on this instance.
 * Use this at the top level of the application to inject (configure)
 * app-specific implementations into the system, as required by the various
 * library modules. To do so, assign a field on this value, such as:
 *
 * ```
 * import { inject } from '@bayou/injecty';
 * inject.frobnicator = new FrobnicateMyApp();
 * ```
 *
 * It is invalid to inject a given name more than once.
 */
const inject = InjectHandler.makeProxy(AllConfigs.theOne.map);

/**
 * Means of getting previously-injected objects and values. This is used at the
 * sites where injected configuration is consumed. To do so, read a field on
 * this value, such as:
 *
 * ```
 * import { use } from '@bayou/injecty';
 * const systemFrobnicator = use.frobnicator;
 * ```
 *
 * To enforce type restrictions on the injected value, use runtime type
 * assertions as per the rest of the system, e.g.:
 *
 * ```
 * import { Frobnicator } from '@bayou/frob';
 * import { use } from '@bayou/injecty';
 * const systemFrobnicator = Frobnicator.check(use.frobnicator);
 * ```
 */
const use = UseHandler.makeProxy(AllConfigs.theOne.map);

export {
  inject,
  use
};
