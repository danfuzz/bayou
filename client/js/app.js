// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor.
 */

import Quill from 'quill';

// Because we aren't building a unified bundle, this `Parchment` isn't actually
// the same class that the Quill internals refer to by that name. This will
// probably lead to weirdness, which is why -- TODO -- we need to get a unified
// bundle to be built.
import Parchment from 'parchment';

// Demonstrates that Webpack conversion and bundling is working as expected.
import { triple } from './typescript_demo';
import { square } from './es2017_demo';

var quill = new Quill('#editor', {
  theme: 'snow'
});

// See comment on `import` lines above.
console.log('ES2017: ' + square(20));
console.log('TypeScript: ' + triple(5));
