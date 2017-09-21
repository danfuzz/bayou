// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseSink } from 'see-all';

describe('see-all/BaseSink', () => {
  describe('stringifyMessage()', () => {
    it('operates as expected', () => {
      function test(expected, ...message) {
        assert.strictEqual(BaseSink.stringifyMessage(...message), expected);
      }

      test(''); // No message.

      test('foo bar baz',
        'foo', 'bar', 'baz');

      test('true',      true);
      test('false',     false);
      test('null',      null);
      test('undefined', undefined);
      test('[]',        []);
      test('123',       123);
      test('[ 1, 2 ]',  [1, 2]);
      test('{ a: 10 }', { a: 10 });
    });
  });
});
