// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codec } from 'codec';
import { EphemeralControl, FileAccess } from 'doc-server';
import { MockFile } from 'file-store/mocks';

describe('doc-server/EphemeralControl', () => {
  /** {FileAccess} Convenient instance of `FileAccess`. */
  const FILE_ACCESS = new FileAccess(Codec.theOne, new MockFile('blort'));

  /** {class} Concrete subclass, for use in testing. */
  class SomeControl extends EphemeralControl { /*empty*/ }

  describe('.ephemeral', () => {
    const control = new SomeControl(FILE_ACCESS, 'boop');
    it('should be `true`', () => {
      assert.isTrue(control.ephemeral);
    });
  });
});
