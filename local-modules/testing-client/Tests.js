// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { assert } from 'chai';

import { Logger } from 'see-all';
import { PromDelay, UtilityClass } from 'util-common';

// If we tweak the Webpack config to point the module `mocha` at the browser-ish
// build, then the following `import` will cause `window.mocha` to be defined.
// It is unclear whether this is really how we want to get this hooked up, which
// is why it remains commented out.
// import 'mocha';
// const mocha = window.mocha;

// This file is dynamically-generated when loadad. See comments in it for more
// detail.
import { registerTests } from './client-tests';

/** {Logger} Logger for this module. */
const log = new Logger('testing-client');

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Client-side helper for setting up and running test code.
 */
export default class Tests extends UtilityClass {
  /**
   * Runs all of the tests.
   *
   * @returns {Promise<string>} Promise for the results of running the tests.
   */
  static runAll() {
    log.info('TODO');
    registerTests();

    // Demonstrate that Chai works.
    assert.isNull(null);
    try {
      assert.isNull(1);
    } catch (e) {
      log.info('Caught expected exception', e);
    }

    return PromDelay.resolve(5000, 'All succeeded! ;-)');
  }
}
