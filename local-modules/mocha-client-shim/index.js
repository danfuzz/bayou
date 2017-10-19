// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` gets the client-friendly versions of the `mocha` bindings into
// the _global_ scope. The rest of the file republishes the bindings as exports
// from _this_ module.
import 'mocha-client-bundle';

/** {Mocha} Main instance of the test driver class. */
const mocha = window.mocha; // eslint-disable-line

function after(action) {
  window.after(action); // eslint-disable-line
}

function afterEach(action) {
  window.afterEach(action); // eslint-disable-line
}

function before(action) {
  window.before(action); // eslint-disable-line
}

function beforeEach(action) {
  window.beforeEach(action); // eslint-disable-line
}

function describe(description, action) {
  window.describe(description, action); // eslint-disable-line
}

// Alias for `describe()`
function context(description, action) {
  window.context(description, action); // eslint-disable-line
}

function it(description, action) {
  window.it(description, action); // eslint-disable-line
}

// Alias for `it()`
function specify(description, action) {
  window.specify(description, action); // eslint-disable-line
}

export { after, afterEach, before, beforeEach, describe, context, it, mocha, specify };
