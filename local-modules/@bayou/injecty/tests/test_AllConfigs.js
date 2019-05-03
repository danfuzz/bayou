// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

// These classes aren't exported publicly, so they need to be imported by path.
import { AllConfigs } from '@bayou/injecty/AllConfigs';
import { ConfigMap } from '@bayou/injecty/ConfigMap';

describe('@bayou/injecty/AllConfigs', () => {
  describe('.map', () => {
    it('is an instance of `ConfigMap`', () => {
      assert.instanceOf(AllConfigs.theOne.map, ConfigMap);
    });
  });
});
