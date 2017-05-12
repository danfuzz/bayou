// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This module's exports are set up to make it reasonably convenient for use
// in test files, which is why it exports naked functions instead of the more
// usual arrangement (for this project) of bundling functions into a utility
// class.

import { Logger } from 'see-all';

/** {Logger} Logger for this module. */
const log = new Logger('test-all');

// TODO: Fill in these stubs.

function after() {
  // TODO: Something.
  log.info('TODO: after');
}

function afterEach() {
  // TODO: Something.
  log.info('TODO: afterEach');
}

function before() {
  // TODO: Something.
  log.info('TODO: before');
}

function beforeEach() {
  // TODO: Something.
  log.info('TODO: beforeEach');
}

function describe() {
  // TODO: Something.
  log.info('TODO: describe');
}

function it() {
  // TODO: Something.
  log.info('TODO: it');
}

export { after, afterEach, before, beforeEach, describe, it };
