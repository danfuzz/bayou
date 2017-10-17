// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// Unlike most modules, we export a special proxy instance instead of doing the
// usual series of `import`s followed by an `export`. This is because the hooks
// defined here can end up `import`ing other modules which in turn want to use
// hooks, that is to say, they can cause a circular dependency.
//
// See the comment in `hooks-server/index.js` for a longer discussion about
// this.

import { DeferredLoader } from 'util-common';

const Hooks = DeferredLoader.makeProxy(
  'common hook',
  () => {
    return require('./Hooks').default;
  });

export { Hooks };
