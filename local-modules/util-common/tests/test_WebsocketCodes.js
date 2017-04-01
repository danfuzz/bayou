// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { WebsocketCodes } from 'util-common';

describe('util-common.WebsocketCodes', () => {
  describe('#close()', () => {
    it('should return a questioning string if given no close code', () => {
      const readable = WebsocketCodes.close();

      assert.equal(readable, 'close_?');
    });
  });

  describe('#close(code)', () => {
    it('should return a fixed format string if passed a known code', () => {
      const output = WebsocketCodes.close(1000);

      assert.equal(output, 'close_normal (1000)');
    });

    it('should return a fixed format string if passed an unknown code', () => {
      const output = WebsocketCodes.close(298374893247);

      assert.equal(output, 'close_298374893247');
    });
  });
});
