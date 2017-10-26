// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TransactionSpec } from 'file-store';
import { CommonBase, Errors } from 'util-common';

import FileAccess from './FileAccess';
import ValidationStatus from './ValidationStatus';

/**
 * Base class for things that hook up to a {@link FileComplex} and for
 * `FileComplex` itself.
 */
export default class BaseComplexMember extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super();

    /** {FileAccess} Low-level file access and associated miscellanea. */
    this._fileAccess = FileAccess.check(fileAccess);
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._fileAccess.codec;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._fileAccess.file;
  }

  /** {FileAccess} Low-level file access and associated miscellanea. */
  get fileAccess() {
    return this._fileAccess;
  }

  /** {FileCodec} File-codec wrapper to use when dealing with encoded data. */
  get fileCodec() {
    return this._fileAccess.fileCodec;
  }

  /** {Logger} Logger to use with this instance. */
  get log() {
    return this._fileAccess.log;
  }

  /**
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for.
   *
   * **Note:** Some concrete instances of this class do not directly manage a
   * document portion and as such do not have any file portion to initialize.
   * Accessing this property on such instances will result in an error being
   * thrown.
   */
  get initSpec() {
    const result = this._impl_initSpec;

    if (result === null) {
      throw Errors.bad_use('Does not manage document data. Should not have called.');
    } else {
      return TransactionSpec.check(result);
    }
  }

  /**
   * Performs any actions that are required in the wake of having run the
   * {@link #initSpec} transaction.
   *
   * **Note:** Some concrete instances of this class do not directly manage a
   * document portion and as such do not have any post-initialization work to
   * do. Calling this method on such instances will result in an error being
   * thrown.
   */
  async afterInit() {
    const result = await this._impl_afterInit();

    if (result === null) {
      throw Errors.bad_use('Does not manage document data. Should not have called.');
    } else if (result !== true) {
      throw Errors.bad_value(result, '_impl_afterInit() response');
    }
  }

  /**
   * Evaluates the condition of the portion of the document controlled by this
   * instance, reporting a "validation status." Except for on
   * {@link FileBootstrap}, this method must not be called unless the file is
   * known to exist. Except for on {@link FileBootstrap} and
   * {@link SchemaHandler}, this method must not be called unless the schema
   * version is known to be valid.
   *
   * **Note:** Some concrete instances of this class do not directly manage a
   * document portion and as such do not participate in validation. Calling this
   * method on such instances will result in an error being thrown.
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async validationStatus() {
    const result = await this._impl_validationStatus();

    if (result === null) {
      throw Errors.bad_use('Not subject to validation. Should not have called.');
    } else {
      return ValidationStatus.check(result);
    }
  }

  /**
   * {TransactionSpec|null} Spec for a transaction which when run will
   * initialize the portion of the file which this class is responsible for.
   * Subclasses must fill this as a valid instance or as `null` to indicate that
   * this class does not manage file data.
   *
   * @abstract
   */
  get _impl_initSpec() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of `afterInit()`. Subclasses must
   * override this to perform post-initialization work and return `true`, or to
   * return `null` to indicate that this class does not manage file data.
   *
   * @abstract
   * @returns {boolean|null} `true` to indicate success, or `null` to indicate
   *   that the method should not have been called.
   */
  async _impl_afterInit() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}. Subclasses
   * must override this to either perform validation or return `null` to
   * indicate that they don't participate in validation.
   *
   * @abstract
   * @returns {string|null} One of the constants defined by
   *  {@link ValidationStatus}, or `null` to indicate that this is not an
   *  object which participates in validation.
   */
  async _impl_validationStatus() {
    return this._mustOverride();
  }
}
