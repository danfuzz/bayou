// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import url from 'url';

/**
 * {class} The `URL` class, which is bound in a different place in the browser
 * and under Node, despite the polyfill (whee).
 */
const theClass = url.URL || URL;

export { theClass as URL };
