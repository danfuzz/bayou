// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseComplexMember } from '@bayou/doc-server';

import { Codecs as appCommon_TheModule } from '@bayou/app-common';
import { FileAccess } from '@bayou/doc-server';
import { MockFile } from '@bayou/file-store/mocks';
import { MockLogger } from '@bayou/see-all/mocks';

describe('@bayou/doc-server/BaseComplexMember', () => {
  describe('constructor()', () => {
    it('accepts a `FileAccess` and reflects it in the getters', () => {
      const codec  = appCommon_TheModule.modelCodec;
      const file   = new MockFile('blort');
      const fa     = new FileAccess(codec, 'x', file);
      const result = new BaseComplexMember(fa, 'boop');

      assert.strictEqual(result.codec,      codec);
      assert.strictEqual(result.file,       file);
      assert.strictEqual(result.fileAccess, fa);
      assert.strictEqual(result.fileCodec,  fa.fileCodec);

      // `log` will be different, because it adds the `logLabel` as a prefix.
      assert.notStrictEqual(result.log, fa.log);
    });

    it('rejects non-`FileAccess` arguments', () => {
      assert.throws(() => new BaseComplexMember(null,      'boop'));
      assert.throws(() => new BaseComplexMember({ x: 10 }, 'boop'));
    });

    it('uses the `logLabel` to create an appropriate `log`', () => {
      const codec  = appCommon_TheModule.modelCodec;
      const log    = new MockLogger();
      const fa     = new FileAccess(codec, 'x', new MockFile('file-id'), log);
      const result = new BaseComplexMember(fa, 'boop');

      result.log.info('florp', 'like');
      const got = log.record[0];

      assert.deepEqual(got, ['info', ['file-id', 'boop'], 'florp', 'like']);
    });
  });
});
