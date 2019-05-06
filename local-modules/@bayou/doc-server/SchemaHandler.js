// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codecs } from '@bayou/doc-common';
import { FileOp } from '@bayou/file-store-ot';

import { BaseDataManager } from './BaseDataManager';
import { Paths } from './Paths';
import { ValidationStatus } from './ValidationStatus';

/**
 * Handler for the schema of a file. As of this writing, this class merely knows
 * how to reject existing documents with schemas other than the latest. In the
 * long term, it will be the locus of responsibility for migration of content
 * from older schemas.
 */
export class SchemaHandler extends BaseDataManager {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess, 'schema');

    /** {string} The document schema version to use and expect. */
    this._schemaVersion = Codecs.SCHEMA_VERSION;

    Object.freeze(this);
  }

  /**
   * {array<FileOp>} Array of {@link FileOp}s which when made into a
   * {@link FileChange} will initialize the portion of the file which this class
   * is responsible for. In this case, it is a single-element array consisting
   * of the {@link FileOp} which stores the file's schema.
   */
  get _impl_initOps() {
    const encodedSchemaVersion = this.fileCodec.codec.encodeJsonBuffer(this._schemaVersion);

    return [FileOp.op_writePath(Paths.SCHEMA_VERSION, encodedSchemaVersion)];
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
    const { file, codec } = this.fileCodec;
    const snapshot        = await file.getSnapshot();
    let schemaVersion;

    try {
      const encodedSchemaVersion = snapshot.getOrNull(Paths.SCHEMA_VERSION);
      schemaVersion = codec.decodeJsonBuffer(encodedSchemaVersion);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_error;
    }

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
