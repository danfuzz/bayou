// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { EphemeralControl } from 'doc-server';

describe('doc-server/EphemeralControl', () => {
  /** {class} Concrete subclass, for use in testing. */
  class SomeControl extends EphemeralControl { /*empty*/ }

  describe('.ephemeral', () => {
    it('should be `true`', () => {
      assert.isTrue(SomeControl.ephemeral);
    });
  });
});
