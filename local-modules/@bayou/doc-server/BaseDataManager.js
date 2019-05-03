// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FileOp } from '@bayou/file-store-ot';
import { TArray } from '@bayou/typecheck';

import { BaseComplexMember } from './BaseComplexMember';
import { ValidationStatus } from './ValidationStatus';

/**
 * Subclass of {@link BaseComplexMember} for things that take top-level
 * responsibility for managing data within a file.
 */
export class BaseDataManager extends BaseComplexMember {
  /**
   * {array<FileOp>} Array of {@link FileOp}s which when made into a
   * {@link FileChange} will initialize the portion of the file which this class
   * is responsible for.
   */
  get initOps() {
    const ops = this._impl_initOps;

    return TArray.check(ops, op => FileOp.check(op));
  }

  /**
   * Performs any actions that are required in the wake of having stored the
   * initial file contents. See also {@link #initOps}.
   */
  async afterInit() {
    // The only point of this arrangement is to preserve the invariant that
    // subclasses are only expected to override `_impl_*` methods.
    await this._impl_afterInit();
  }

  /**
   * Evaluates the condition of the portion of the document controlled by this
   * instance, reporting a "validation status." Except for on
   * {@link FileBootstrap}, this method must not be called unless the file is
   * known to exist. Except for on {@link FileBootstrap} and
   * {@link SchemaHandler}, this method must not be called unless the schema
   * version is known to be valid.
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async validationStatus() {
    const result = ValidationStatus.check(await this._impl_validationStatus());

    this.log.event.validationStatus(result);

    return result;
  }

  /**
   * {array<FileOp>} Array of {@link FileOp}s which when made into a
   * {@link FileChange} will initialize the portion of the file which this class
   * is responsible for Subclasses must override this.
   *
   * @abstract
   */
  get _impl_initOps() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of `afterInit()`. Subclasses must
   * override this to perform post-initialization work.
   *
   * @abstract
   */
  async _impl_afterInit() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}. Subclasses
   * must override this to perform validation.
   *
   * @abstract
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    return this._mustOverride();
  }
}
