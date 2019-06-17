// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BuildInfo } from '@bayou/env-server/BuildInfo';

describe('@bayou/env-server/BuildInfo', () => {
  describe('.info', () => {
    it('is a frozen object', () => {
      const info = new BuildInfo().info;

      assert.isObject(info);
      assert.isFrozen(info);
    });

    it('contains the expected product info', () => {
      const info = new BuildInfo().info;
      const requiredKeys = [
        'buildDate', 'buildId', 'buildNumber', 'commitId', 'commitDate', 'name', 'nodeVersion', 'version'
      ];
      const optionalKeys = [
        'artificialFailurePercent', 'artificialFailureType'
      ];

      for (const k of optionalKeys) {
        if (info[k] !== undefined) {
          delete info[k];
        }
      }

      assert.hasAllKeys(info, requiredKeys);
    });
  });
});
