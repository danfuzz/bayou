// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ClientTestsLoader from './ClientTestsLoader';

// This module is used by Webpack, which makes specific requirements about what
// is exported by loaders. This is why we have a simple `export default` here
// instead of the more usual (for this project) set of named `export {...}`s.
export default ClientTestsLoader.load;
