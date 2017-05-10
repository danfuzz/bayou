// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Logger } from 'see-all';
import { PromDelay } from 'util-common';

// This is a dynamically-generated file. See comments in it for more detail.
import ClientTests from './client-tests';

/** {Logger} Logger for this module. */
const log = new Logger('testing-client');

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Client-side helper for setting up and running test code.
 */
export default class Tests {
  /**
   * Runs all of the tests.
   *
   * @returns {Promise<string>} Promise for the results of running the tests.
   */
  static runAll() {
    log.info('TODO');
    ClientTests.run();
    return PromDelay.resolve(5000, 'All succeeded! ;-)');
  }
}
