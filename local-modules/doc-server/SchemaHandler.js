// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ProductInfo } from 'env-server';
import { TransactionSpec } from 'file-store';
import { TString } from 'typecheck';

import BaseComplexMember from './BaseComplexMember';
import Paths from './Paths';

/**
 * Handler for the schema of a file. As of this writing, this class merely knows
 * how to reject existing documents with schemas other than the latest. In the
 * long term, it will be the locus of responsibility for migration of content
 * from older schemas.
 */
export default class SchemaHandler extends BaseComplexMember {
  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_ERROR() {
    return 'status_error';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_MIGRATE() {
    return 'status_migrate';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_NOT_FOUND() {
    return 'status_not_found';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_OK() {
    return 'status_ok';
  }

  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

    /** {string} The document schema version to use and expect. */
    this._schemaVersion = TString.nonEmpty(ProductInfo.theOne.INFO.version);

    Object.freeze(this);
  }

  /**
   * Creates or re-creates the file. This will result in a file that is totally
   * devoid of content _except_ for a schema version. This method assumes that
   * the underlying file already exists (has been `create()d`).
   */
  async create() {
    this.log.info('Creating / re-creating file.');

    const fc   = this.fileCodec; // Avoids boilerplate immediately below.
    const spec = new TransactionSpec(
      // If the file already existed, this clears out the old contents.
      // **TODO:** In cases where this is a re-creation based on a migration
      // problem, we probably want to preserve the old data by moving it aside
      // (e.g. into a `lossage/<timestamp>` prefix) instead of just blasting it
      // away entirely.
      fc.op_deleteAll(),

      // Version for the file schema.
      fc.op_writePath(Paths.SCHEMA_VERSION, this._schemaVersion)
    );

    await this.file.transact(spec);
  }

  /**
   * Evaluates the condition of the document, reporting a "validation status."
   * The return value is one of the `STATUS_*` constants defined by this class:
   *
   * * `STATUS_OK` &mdash; No problems.
   * * `STATUS_MIGRATE` &mdash; Document is in a format that is not understood.
   * * `STATUS_NOT_FOUND` &mdash; The document doesn't exist.
   * * `STATUS_ERROR` &mdash; Document is in an unrecoverably-bad state.
   *
   * This method will also emit information to the log about problems.
   *
   * @returns {string} The validation status.
   */
  async validationStatus() {
    if (!(await this.file.exists())) {
      return SchemaHandler.STATUS_NOT_FOUND;
    }

    let transactionResult;

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(Paths.SCHEMA_VERSION)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return SchemaHandler.STATUS_ERROR;
    }

    const data          = transactionResult.data;
    const schemaVersion = data.get(Paths.SCHEMA_VERSION);

    if (!schemaVersion) {
      this.log.info('Corrupt document: Missing schema version.');
      return SchemaHandler.STATUS_ERROR;
    }

    const expectSchemaVersion = this._schemaVersion;
    if (schemaVersion !== expectSchemaVersion) {
      const got = schemaVersion;
      this.log.info(`Mismatched schema version: got ${got}; expected ${expectSchemaVersion}`);
      return SchemaHandler.STATUS_MIGRATE;
    }

    return SchemaHandler.STATUS_OK;
  }
}
