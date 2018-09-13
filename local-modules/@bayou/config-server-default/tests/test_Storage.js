// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Storage } from '@bayou/config-server-default';
import { BodyDelta } from '@bayou/doc-common';
import { LocalDataStore } from '@bayou/data-store-local';
import { LocalFileStore } from '@bayou/file-store-local';

describe('@bayou/config-server-default/Storage', () => {
  describe('.DEFAULT_DOCUMENT_BODY', () => {
    it('should be an instance of `BodyDelta`', () => {
      assert.instanceOf(Storage.DEFAULT_DOCUMENT_BODY, BodyDelta);
    });
  });

  describe('.dataStore', () => {
    it('should be an instance of `LocalDataStore`', () => {
      assert.isObject(Storage.dataStore);
      assert.instanceOf(Storage.dataStore, LocalDataStore);
    });

    it('should return the same actual object on every access', () => {
      const store = Storage.dataStore;

      for (let i = 0; i < 10; i++) {
        assert.strictEqual(Storage.dataStore, store, `#${i}`);
      }
    });
  });

  describe('.fileStore', () => {
    it('should be an instance of `LocalFileStore`', () => {
      assert.isObject(Storage.fileStore);
      assert.instanceOf(Storage.fileStore, LocalFileStore);
    });

    it('should return the same actual object on every access', () => {
      const store = Storage.fileStore;

      for (let i = 0; i < 10; i++) {
        assert.strictEqual(Storage.fileStore, store, `#${i}`);
      }
    });
  });
});
