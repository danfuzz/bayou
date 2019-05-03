// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';

import { PromSubclasser } from '@bayou/quill-util';

/**
 * Subclass of `Quill` with a promise-chain mechanism for event access.
 *
 * **Note:** This class is built "semi-dynamically", instead of just being a
 * normal subclass defined in `quill-util`, because the system allows the
 * `Quill` class that's used to be configurable, and the configuration code
 * doesn't get a chance to run before the first reference to the `quill-util`
 * module.
 */
const QuillProm = PromSubclasser.makeSubclass(Quill);

export { QuillProm };
