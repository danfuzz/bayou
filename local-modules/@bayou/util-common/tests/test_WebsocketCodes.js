// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { WebsocketCodes } from '@bayou/util-common';

describe('@bayou/util-common/WebsocketCodes', () => {
  describe('close()', () => {
    it('returns a questioning string', () => {
      const readable = WebsocketCodes.close();

      assert.strictEqual(readable, 'close_?');
    });
  });

  describe('close(null)', () => {
    it('returns a questioning string', () => {
      const readable = WebsocketCodes.close(null);

      assert.strictEqual(readable, 'close_?');
    });
  });

  describe('close(code)', () => {
    it('returns a fixed format string if passed a known code', () => {
      const output = WebsocketCodes.close(1000);

      assert.strictEqual(output, 'close_normal (1000)');
    });

    it('returns a fixed format string if passed an unknown code', () => {
      const output = WebsocketCodes.close(298374893247);

      assert.strictEqual(output, 'close_298374893247');
    });
  });
});
