// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codec } from 'codec';
import { FileAccess } from 'doc-server';

import MockControl from './MockControl';
import MockFile from './MockFile';

describe('doc-server/BaseControl', () => {
  describe('constructor()', () => {
    it('should accept a `FileAccess` and reflect it in the inherited getters', () => {
      const codec  = Codec.theOne;
      const file   = new MockFile('blort');
      const fa     = new FileAccess(codec, file);
      const result = new MockControl(fa);

      assert.strictEqual(result.codec,         codec);
      assert.strictEqual(result.file,          file);
      assert.strictEqual(result.fileAccess,    fa);
      assert.strictEqual(result.fileCodec,     fa.fileCodec);
      assert.strictEqual(result.log,           fa.log);
      assert.strictEqual(result.schemaVersion, fa.schemaVersion);
    });

    it('should reject non-`FileAccess` arguments', () => {
      assert.throws(() => new MockControl(null));
      assert.throws(() => new MockControl({ x: 10 }));
    });
  });

  // **TODO:** Fill this out!
});
