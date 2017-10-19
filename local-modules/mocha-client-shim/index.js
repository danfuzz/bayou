// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` gets the client-friendly versions of the `mocha` bindings into
// the _global_ scope. The rest of the file republishes the bindings as exports
// from _this_ module.
import 'mocha-client-bundle';

/**
 * {Window} The browser globals. We have ESLint configured conservatively by
 * default (so as to be reasonable for both Node and browser). The `*disable*`
 * directive lets us tactically access the globals, and then we can be on our
 * merry way.
 */
const global = window; // eslint-disable-line no-undef

/** {Mocha} Main instance of the test driver class. */
const mocha = global.mocha;

// Add the BDD methods to the globals.
mocha.setup({
  reporter: 'tap',
  ui:       'bdd'
});

// Extract the BDD API functions.
const {
  after, afterEach, before, beforeEach, describe, context, it, specify
} = global;

export {
  mocha,
  after, afterEach, before, beforeEach, describe, context, it, specify
};
