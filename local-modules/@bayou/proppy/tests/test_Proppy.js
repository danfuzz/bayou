// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Proppy } from '@bayou/proppy';
import { TObject } from '@bayou/typecheck';

describe('@bayou/proppy/Proppy', () => {
  describe('parseString(value)', () => {
    it('should ignore comments and blank lines', () => {
      const input = '# this is comment line one\n' +
                    '# this is comment line two\n' +
                    '\n' +
                    'key=value\n' +
                    '# this is comment line three';

      _testStringParsing(input, { key: 'value' });
    });

    it('accepts multiple keys and values', () => {
      const input = 'key = value\nkey2 = value2\nkey3 = value3';

      _testStringParsing(input, { key: 'value', key2: 'value2', key3: 'value3' });
    });

    it('accepts single quoted keys and values', () => {
      const input = "'key' = 'value'";

      _testStringParsing(input, { key: 'value' });
    });

    it('accepts double quoted keys and values', () => {
      const input = '"key" = "value"';

      _testStringParsing(input, { key: 'value' });
    });

    it('accepts unquoted keys and values if they consist entirely of blessed characters', () => {
      let input = null;

      input = 'key = value';
      _testStringParsing(input, { key: 'value' });

      input = 'key1 = value1';
      _testStringParsing(input, { key1: 'value1' });

      input = 'key_1 = value_1';
      _testStringParsing(input, { key_1: 'value_1' });

      input = 'key-1 = value-1';
      _testStringParsing(input, { 'key-1': 'value-1' });

      input = 'key.1 = value.1';
      _testStringParsing(input, { 'key.1': 'value.1' });

      input = 'key/1 = value/1';
      _testStringParsing(input, { 'key/1': 'value/1' });

      input = '_.-/-._ = mound';
      _testStringParsing(input, { '_.-/-._': 'mound' });
    });

    it('does not accept unquoted keys or values that have unblessed characters', () => {
      let input = null;

      // Non-7-bit character
      input = 'key•1 = value•1';
      assert.throws(() => _testStringParsing(input, { 'key•1': 'value•1' }));

      // Space in key
      input = 'key 1 = value';
      assert.throws(() => _testStringParsing(input, { 'key 1': 'value' }));

      // Space in value
      input = 'key = value 1';
      assert.throws(() => _testStringParsing(input, { key: 'value 1' }));

      // Unblessed separator
      input = 'key+1 = value+1';
      assert.throws(() => _testStringParsing(input, { 'key+1': 'value+1' }));
    });

    it('accepts unquoted keys and values if they consist entirely of blessed characters', () => {
      const input = 'key = "value\n' +
                    'this is a multiline value"';

      _testStringParsing(input, { key: 'value\nthis is a multiline value' });
    });

    it('should parse accepted escape sequences', () => {
      let input = null;

      input = '"key\\\\" = "value"';
      _testStringParsing(input, { 'key\\': 'value' });

      input = '"key\\\'" = "value"';
      _testStringParsing(input, { 'key\'': 'value' });

      input = '"key\\"" = "value"';
      _testStringParsing(input, { 'key"': 'value' });

      input = '"key\\n" = "value"';
      _testStringParsing(input, { 'key\n': 'value' });

      input = '"key\\t" = "value"';
      _testStringParsing(input, { 'key\t': 'value' });
    });

    it('does not accept unapproved escape sequences', () => {
      let input = null;

      input = '"key\\r" = value';
      assert.throws(() => _testStringParsing(input, { 'key\r': 'value' }));

      input = '"key\\b" = value';
      assert.throws(() => _testStringParsing(input, { 'key\b': 'value' }));
    });

    it('does not accept approved escape sequences in unquoted keys or values', () => {
      let input = null;

      input = 'key\\\\ = value';
      assert.throws(() => _testStringParsing(input, { 'key\\': 'value' }));

      input = 'key = value\\t';
      assert.throws(() => _testStringParsing(input, { key: 'value\t' }));
    });
  });
});

function _testStringParsing(input, expectedObject) {
  let output = null;

  assert.doesNotThrow(function () {
    output = Proppy.parseString(input);
  });

  const keys = Object.keys(expectedObject);

  assert.strictEqual(TObject.withExactKeys(output, keys), output);

  for (const key of keys) {
    assert.strictEqual(output[key], expectedObject[key]);
  }
}
