// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Urls } from '@bayou/app-common';

describe('@bayou/app-common/Urls', () => {
  describe('.API_PATH', () => {
    it('is a non-empty string', () => {
      assert.isString(Urls.API_PATH);
      assert.isTrue(Urls.API_PATH.length > 0);
    });

    it('does not start with a slash', () => {
      assert.notStrictEqual(Urls.API_PATH[0], '/');
    });

    it('does not end with a slash', () => {
      const path     = Urls.API_PATH;
      const lastChar = path[path.length - 1];
      assert.notStrictEqual(lastChar, '/');
    });
  });

  describe('apiUrlFromBaseUrl()', () => {
    it('appends the `API_PATH` after a slash', () => {
      function test(base) {
        const api  = `${base}/${Urls.API_PATH}`;
        const got  = Urls.apiUrlFromBaseUrl(base);

        assert.strictEqual(got, api);
      }

      test('https://foo.blort/zap');
      test('https://foo.blort/zap/zoop');
      test('https://boo.eek:1234/zap');
      test('https://boo.eek:1234/zip/zap/zop');

      // Origin-only, no final slash.
      test('https://example.com');
      test('https://example.com:1234');
    });

    it('does not add an extra slash if the given `baseUrl` already ends with one', () => {
      const base = 'https://foo.blort/zoop/';
      const api  = `${base}${Urls.API_PATH}`;
      const got  = Urls.apiUrlFromBaseUrl(base);

      assert.strictEqual(got, api);
    });
  });

  describe('apiUrlFromBaseUrl()', () => {
    it('strips the `API_PATH` at the end, with or without a trailing slash', () => {
      const base     = 'https://milk.yummy/boop/beep';
      const api      = `${base}/${Urls.API_PATH}`;
      const got      = Urls.baseUrlFromApiUrl(api);
      const gotSlash = Urls.baseUrlFromApiUrl(`${api}/`);

      assert.strictEqual(got, base);
      assert.strictEqual(gotSlash, base);
    });
  });
});
