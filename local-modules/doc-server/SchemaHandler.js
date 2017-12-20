// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ProductInfo } from 'env-server';
import { TransactionSpec } from 'file-store';
import { TString } from 'typecheck';

import BaseDataManager from './BaseDataManager';
import Paths from './Paths';
import ValidationStatus from './ValidationStatus';

/**
 * Handler for the schema of a file. As of this writing, this class merely knows
 * how to reject existing documents with schemas other than the latest. In the
 * long term, it will be the locus of responsibility for migration of content
 * from older schemas.
 */
export default class SchemaHandler extends BaseDataManager {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess, 'schema');

    /** {string} The document schema version to use and expect. */
    this._schemaVersion = TString.nonEmpty(ProductInfo.theOne.INFO.version);

    Object.freeze(this);
  }

  /**
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for.
   */
  get _impl_initSpec() {
    return new TransactionSpec(
      // Version for the file schema.
      this.fileCodec.op_writePath(Paths.SCHEMA_VERSION, this._schemaVersion)
    );
  }

  /**
   * Subclass-specific implementation of `afterInit()`.
   */
  async _impl_afterInit() {
    // No action needed... yet.
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}.
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    let transactionResult;

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(Paths.SCHEMA_VERSION)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_error;
    }

    const data          = transactionResult.data;
    const schemaVersion = data.get(Paths.SCHEMA_VERSION);

    if (!schemaVersion) {
      this.log.info('Corrupt document: Missing schema version.');
      return ValidationStatus.STATUS_error;
    }

    const expectSchemaVersion = this._schemaVersion;
    if (schemaVersion !== expectSchemaVersion) {
      const got = schemaVersion;
      this.log.info(`Mismatched schema version: got ${got}; expected ${expectSchemaVersion}`);
      return ValidationStatus.STATUS_migrate;
    }

    return ValidationStatus.STATUS_ok;
  }
}
