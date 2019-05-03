// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ClientTestsLoader } from './ClientTestsLoader';

// This file is imported directly by Webpack as a loader. Webpack makes specific
// requirements about what is exported by loader modules, which is why we have a
// simple `export default` of a function here, instead of the more usual (for
// this project) arrangement.
export default ClientTestsLoader.load;
