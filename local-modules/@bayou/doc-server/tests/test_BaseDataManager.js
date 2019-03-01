// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { BaseDataManager, FileAccess, ValidationStatus } from '@bayou/doc-server';
import { MockFile } from '@bayou/file-store/mocks';

/** {FileAccess} Convenient instance of `FileAccess`. */
const FILE_ACCESS = new FileAccess(appCommon_TheModule.modelCodec, 'doc-123', new MockFile('blort'));

describe('@bayou/doc-server/BaseDataManager', () => {
  describe('afterInit()', () => {
    it('should call through to the impl', async () => {
      const dm = new BaseDataManager(FILE_ACCESS, 'boop');

      let callCount = 0;
      dm._impl_afterInit = async () => {
        callCount++;
        return 'return value should be ignored';
      };

      const result = await dm.afterInit();
      assert.strictEqual(callCount, 1);
      assert.isUndefined(result);
    });

    it('should throw whatever error is thrown by the impl', async () => {
      const dm = new BaseDataManager(FILE_ACCESS, 'boop');
      dm._impl_afterInit = async () => {
        throw new Error('oy');
      };

      await assert.isRejected(dm.afterInit(), /^oy$/);
    });
  });

  describe('validationStatus()', () => {
    it('should call through to the impl', async () => {
      const dm = new BaseDataManager(FILE_ACCESS, 'boop');

      let callCount = 0;
      dm._impl_validationStatus = async () => {
        callCount++;
        return ValidationStatus.STATUS_ok;
      };

      const result = await dm.validationStatus();
      assert.strictEqual(callCount, 1);
      assert.strictEqual(result, ValidationStatus.STATUS_ok);
    });

    it('should throw whatever error is thrown by the impl', async () => {
      const dm = new BaseDataManager(FILE_ACCESS, 'boop');
      dm._impl_validationStatus = async () => {
        throw new Error('oy');
      };

      await assert.isRejected(dm.validationStatus(), /^oy$/);
    });

    it('should reject bogus impl return values', async () => {
      const dm = new BaseDataManager(FILE_ACCESS, 'boop');
      dm._impl_validationStatus = async () => {
        return ['not actually a validation status'];
      };

      await assert.isRejected(dm.validationStatus(), /badValue/);
    });
  });
});
