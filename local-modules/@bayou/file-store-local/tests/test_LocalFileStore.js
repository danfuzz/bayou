// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { before, describe, it } from 'mocha';

import { LocalFileStore } from '@bayou/file-store-local';

describe('@bayou/file-store-local/LocalFileStore', () => {
  let lfs = null;
  before(() => {
    lfs = new LocalFileStore();
  });

  describe('isFileId()', () => {
    it('should accept 32-character alphanum ASCII strings', () => {
      assert.isTrue(lfs.isFileId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(lfs.isFileId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(lfs.isFileId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(lfs.isFileId('123456789\t123456789+12'));
    });

    it('should throw an error given a non-string', () => {
      assert.throws(() => lfs.isFileId(123), /badValue/);
    });
  });
});
