// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TString } from 'typecheck';

describe('typecheck.TString', () => {
  describe('#check(value)', () => {
    it('should return the provided value when passed a string', () => {
      const value = 'this better work!';

      assert.equal(TString.check(value), value);
    });

    it('should throw an Error when passed anything other than a string', () => {
      assert.throws(() => TString.check(54));
      assert.throws(() => TString.check(true));
      assert.throws(() => TString.check([]));
      assert.throws(() => TString.check({ }));
      assert.throws(() => TString.check(() => true));
      assert.throws(() => TString.check(undefined));
    });
  });

  describe('#check(value, regex)', () => {
    it('should allow a string when it matches the provided regex', () => {
      const value = 'deadbeef7584930215cafe';

      assert.doesNotThrow(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });

    it('should throw an Error when a string fails to match the provided regex', () => {
      const value = 'this better not work!';

      assert.throws(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });

    describe('#hexBytes(value)', () => {
      it('should return the provided value if it is a string of hex bytes', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value), value);
      });

      it('should throw an Error when anything other than a string of hex bytes is provided', () => {
        const value = 'this better not work!';

        assert.throws(() => TString.hexBytes(value));
      });
    });

    describe('#hexBytes(value, minBytes)', () => {
      it('should return the provided value if it is a string of hex bytes of the required minimum length', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value, 11), value);
      });

      it('should return the provided value if it is a string of hex bytes greater than the required minimum length', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value, 3), value);
      });

      it('should throw an Error if the number of bytes is less than the minimum', () => {
        const value = 'deadbeef7584930215cafe';

        assert.throws(() => TString.hexBytes(value, 128));
      });
    });

    describe('#hexBytes(value, inclusiveMinBytes, inclusiveMaxBytes)', () => {
      it('should return the provided value if it is a string of hex bytes of the required minimum length', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value, 11, 128), value);
      });

      it('should return the provided value if it is a string of hex bytes within the required length range', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value, 3, 128), value);
      });

      it('should return the provided value if it is a string of hex bytes equal to the maximum length', () => {
        const value = 'deadbeef7584930215cafe';

        assert.equal(TString.hexBytes(value, 3, 11), value);
      });

      it('should throw an Error if the number of bytes is less than the minimum', () => {
        const value = 'deadbeef7584930215cafe';

        assert.throws(() => TString.hexBytes(value, 32, 64));
      });

      it('should throw an Error if the number of bytes is greater than the minimum', () => {
        const value = 'deadbeef7584930215cafe';

        assert.throws(() => TString.hexBytes(value, 4, 8));
      });
    });
  });

  describe('#nonempty(value)', () => {
    it('should return the provided value if it is a string with length >= 1', () => {
      const value = 'This better work!';

      assert.equal(TString.nonempty(value), value);
    });

    it('should throw an Error if value is a string of length 0', () => {
      const value = '';

      assert.throws(() => TString.nonempty(value));
    });
  });

  describe('#orNull(value)', () => {
    it('should return the provided value if it is a string', () => {
      const value = 'This better work!';

      assert.equal(TString.orNull(value), value);
    });

    it('should return the provided value if it is null', () => {
      const value = null;

      assert.equal(TString.orNull(value), value);
    });

    it('should throw an Error if value is not a string and is not null', () => {
      assert.throws(() => TString.orNull(undefined));
      assert.throws(() => TString.orNull(5.1));
      assert.throws(() => TString.orNull([]));
      assert.throws(() => TString.orNull({ }));
      assert.throws(() => TString.orNull(NaN));
    });
  });

  describe('#urlAbsolute(value)', () => {
    it('should return the provided value if it is an absolute url string', () => {
      const value = 'https://www.example.com';

      assert.equal(TString.urlAbsolute(value), value);
    });

    it('should throw an Error if value is not an absolute url', () => {
      assert.throws(() => TString.urlAbsolute('this better not work!'));
      assert.throws(() => TString.urlAbsolute('/home/users/fnord'));
      assert.throws(() => TString.urlAbsolute(5.1));
      assert.throws(() => TString.urlAbsolute(undefined));
      assert.throws(() => TString.urlAbsolute(null));
    });
  });
});
