// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Deployment } from '@bayou/config-server-default';

describe('@bayou/config-server-default/Deployment', () => {
  describe('findVarDirectory()', () => {
    it('should append `/var` to its argument', () => {
      assert.strictEqual(Deployment.findVarDirectory('/foo'), '/foo/var');
    });
  });

  describe('isRunningInDevelopment()', () => {
    it('returns `true`', () => {
      assert.isTrue(Deployment.isRunningInDevelopment());
    });
  });

  describe('aboutToRun()', () => {
    it('returns without throwing', () => {
      assert.doesNotThrow(() => Deployment.aboutToRun(['argument is ignored']));
    });
  });
});
