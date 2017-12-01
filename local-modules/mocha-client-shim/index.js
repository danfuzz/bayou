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

/**
 * {MochaShim|null} Unique instance of this class, or `null` if it hasn't yet
 * been instantiated.
 */
let theOne = null;

/**
 * Proxy-like shim for `Mocha` which exposes a constructor that behaves like
 * a _real_ `Mocha` instance but (unlike it) can be used on the client side. It
 * operates by passing the constructor argument onward to the singleton global
 * `mocha` (as defined by Mocha) as well as forwarding calls to `run()`.
 */
class MochaShim {
  constructor(opts) {
    if (theOne !== null) {
      throw new Error('Can only instantiate once.');
    }

    mocha.setup(opts);

    theOne = this;
  }

  run(...args) {
    return mocha.run(...args);
  }
}

// BDD-style functions which just forward their calls to the globally-defined
// functions of the same name. This arrangement is done because Mocha won't
// actually define the global functions until `setup()` is called, and this
// module isn't in a position to call `setup()` (because there are other
// configuration options which will be determined by this module's ultimate
// client.)
function after(...args)      { return global.after(...args);      }
function afterEach(...args)  { return global.afterEach(...args);  }
function before(...args)     { return global.before(...args);     }
function beforeEach(...args) { return global.beforeEach(...args); }
function describe(...args)   { return global.describe(...args);   }
function context(...args)    { return global.context(...args);    }
function it(...args)         { return global.it(...args);         }
function specify(...args)    { return global.specify(...args);    }

export {
  MochaShim as Mocha,
  after, afterEach, before, beforeEach, describe, context, it, specify
};
