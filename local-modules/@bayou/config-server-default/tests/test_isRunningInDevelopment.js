// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { isRunningInDevelopment } from '@bayou/config-server-default';

describe('@bayou/config-server-default', () => {
  describe('isRunningInDevelopment()', () => {
    it('should return `true`', () => {
      assert.isTrue(isRunningInDevelopment());
    });
  });
});
