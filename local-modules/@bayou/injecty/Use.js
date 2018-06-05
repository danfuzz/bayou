// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Means of getting previously-injected objects and values. This class is used
 * at the sites where injected configuration is consumed. To do so, read a
 * field on this class, such as:
 *
 * ```
 * const systemFrobnicator = Use.frobnicator;
 * ```
 *
 * To enforce type restrictions on the injected value, use runtime type
 * assertions as per the rest of the system, e.g.:
 *
 * ```
 * import { Frobnicator } from '@bayou/frob';
 * const systemFrobnicator = Frobnicator.check(Use.frobnicator);
 * ```
 */
export default class Use extends UtilityClass {
}
