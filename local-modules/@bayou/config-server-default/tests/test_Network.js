// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Network } from '@bayou/config-server-default';

describe('@bayou/config-server-default/Network', () => {
  describe('.baseUrl', () => {
    it('should be `http://localhost:8080`', () => {
      assert.strictEqual(Network.baseUrl, 'http://localhost:8080');
    });
  });

  describe('.listenPort', () => {
    it('should be `8080`', () => {
      assert.strictEqual(Network.listenPort, 8080);
    });
  });

  describe('.monitorPort', () => {
    it('should be `8888`', () => {
      assert.strictEqual(Network.monitorPort, 8888);
    });
  });
});
