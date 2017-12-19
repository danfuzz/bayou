// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseComplexMember } from 'doc-server';

import { Codec } from 'codec';
import { FileAccess } from 'doc-server';
import { MockFile } from 'file-store/mocks';
import { MockLogger } from 'see-all/mocks';

describe('doc-server/BaseComplexMember', () => {
  describe('constructor()', () => {
    it('should accept a `FileAccess` and reflect it in the getters', () => {
      const codec  = Codec.theOne;
      const file   = new MockFile('blort');
      const fa     = new FileAccess(codec, file);
      const result = new BaseComplexMember(fa, 'boop');

      assert.strictEqual(result.codec,      codec);
      assert.strictEqual(result.file,       file);
      assert.strictEqual(result.fileAccess, fa);
      assert.strictEqual(result.fileCodec,  fa.fileCodec);

      // `log` will be different, because it adds the `logLabel` as a prefix.
      assert.notStrictEqual(result.log, fa.log);
    });

    it('should reject non-`FileAccess` arguments', () => {
      assert.throws(() => new BaseComplexMember(null,      'boop'));
      assert.throws(() => new BaseComplexMember({ x: 10 }, 'boop'));
    });

    it('should use the `logLabel` to create an appropriate `log`', () => {
      const log    = new MockLogger();
      const fa     = new FileAccess(Codec.theOne, new MockFile('file-id'), log);
      const result = new BaseComplexMember(fa, 'boop');

      result.log.info('florp', 'like');
      const got = log.record[0];

      assert.deepEqual(got, ['info', 'florp', 'like']);
    });
  });
});
