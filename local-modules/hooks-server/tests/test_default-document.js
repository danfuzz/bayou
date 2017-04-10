// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import document from '../default-document';

describe('hooks-server.default-document', () => {
  describe('default document', () => {
    it('should return be an array of Parchment insert objects', () => {
      assert.isArray(document);

      for (const command of document) {
        assert.isObject(command);
        assert.property(command, 'insert');
        assert.isString(command['insert']);
      }
    });
  });
});
