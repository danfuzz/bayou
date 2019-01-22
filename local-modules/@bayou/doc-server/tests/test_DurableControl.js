// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DurableControl } from '@bayou/doc-server';

describe('@bayou/doc-server/DurableControl', () => {
  /** {class} Concrete subclass, for use in testing. */
  class SomeControl extends DurableControl { /*empty*/ }

  describe('.ephemeral', () => {
    it('should be `false`', () => {
      assert.isFalse(SomeControl.ephemeral);
    });
  });
});
