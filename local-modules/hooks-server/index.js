// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// Unlike most modules, we export a special proxy instance instead of doing the
// usual series of `import`s followed by an `export`. This is because the hooks
// defined here can end up `import`ing other modules which in turn want to use
// hooks, that is to say, they can cause a circular dependency.
//
// We break the circle by deferring loading of the real hooks until first
// actual usage of a hook property (or method), at which point all of the
// initial module loading should have all resolved.
//
// We choose this module _specifically_ (and its client-side counterpart) as
// the locale to break the would-be cycle, because this module by its nature is
// a dependency bottleneck _and_ tends to be loosely coupled with its
// dependencies. So, (on the first front) breaking it here means there are many
// fewer other places where we need to worry about this, and (on the second
// front) this is a relatively un-precarious place to perform the breaking.
//
// **Note:** If you switch this to just doing `import Hooks`, then what will
// ultimately happen is that some `import` will fail "soft" by returning
// `undefined`. It is impossible to predict in advance _which_ `import`
// will fail, though.

import { DataUtil, DeferredLoader } from 'util-common';

import BearerTokens from './BearerTokens';
import default_document from './default-document';

const Hooks = DeferredLoader.makeProxy(
  'server hook',
  () => {
    return require('./Hooks').default;
  });

const DEFAULT_DOCUMENT = DataUtil.deepFreeze(default_document);

export { DEFAULT_DOCUMENT, BearerTokens, Hooks };
