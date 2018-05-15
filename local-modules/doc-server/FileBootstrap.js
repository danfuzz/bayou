// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta } from 'doc-common';
import { TransactionSpec } from '@bayou/file-store-ot';
import { DEFAULT_DOCUMENT } from 'hooks-server';
import { Timestamp } from '@bayou/ot-common';
import { Mutex } from '@bayou/promise-util';
import { Errors } from '@bayou/util-common';

import BaseDataManager from './BaseDataManager';
import BodyControl from './BodyControl';
import CaretControl from './CaretControl';
import PropertyControl from './PropertyControl';
import SchemaHandler from './SchemaHandler';
import ValidationStatus from './ValidationStatus';

/** {BodyDelta} Default contents when creating a new document. */
const DEFAULT_TEXT = new BodyDelta(DEFAULT_DOCUMENT);

/**
 * {BodyDelta} Message used as document to indicate a major validation error.
 */
const ERROR_NOTE = new BodyDelta([
  ['text', '(Recreated document due to validation error(s).)\n']
]);

/**
 * {BodyDelta} Message used as document instead of migrating documents from
 * old schema versions.
 */
const MIGRATION_NOTE = new BodyDelta([
  ['text', '(Recreated document due to schema version skew.)\n']
]);

/** {BodyDelta} Message used as document instead of attempting recovery. */
const RECOVERY_NOTE = new BodyDelta([
  ['text', '(Recreated document due to allegedly-recoverable corruption.)\n']
]);

/**
 * Handler for the "bootstrap" setup of a file, including initializing new
 * files, validating existing files, and dealing with validation problems.
 */
export default class FileBootstrap extends BaseDataManager {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess, 'boot');

    /** {Mutex} Mutex to avoid overlapping initialization operations. */
    this._initMutex = new Mutex();

    /** {boolean} Whether or not initialization has been completed. */
    this._initialized = false;

    /** {BodyControl} Document body content controller. */
    this._bodyControl = new BodyControl(fileAccess);

    /** {CaretControl} Caret info controller. */
    this._caretControl = new CaretControl(fileAccess);

    /** {PropertyControl} Property (metadata) controller. */
    this._propertyControl = new PropertyControl(fileAccess);

    /** {SchemaHandler} Schema (and migration) handler. */
    this._schemaHandler = new SchemaHandler(fileAccess);

    Object.seal(this);
  }

  /** {BodyControl} The body content controller to use with this instance. */
  get bodyControl() {
    this._initCheck();
    return this._bodyControl;
  }

  /** {CaretControl} The caret info controller to use with this instance. */
  get caretControl() {
    this._initCheck();
    return this._caretControl;
  }

  /** {PropertyControl} The property controller to use with this instance. */
  get propertyControl() {
    this._initCheck();
    return this._propertyControl;
  }

  /**
   * Initializes the document content.
   *
   * @returns {boolean} `true` once setup and initialization are complete.
   */
  async init() {
    return this._initMutex.withLockHeld(async () => {
      if (!this._initialized) {
        await this._init();
        this._initialized = true;
      }
      return true;
    });
  }

  /**
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for. In this case, it
   * constructs the combined spec for the entire file, based on all the
   * subcomponents.
   */
  get _impl_initSpec() {
    const eraseSpec = new TransactionSpec(
      // If the file already existed, this clears out the old contents.
      // **TODO:** In cases where this is a re-creation based on a migration
      // problem, we probably want to preserve the old data by moving it aside
      // (e.g. into a `lossage/<timestamp>` prefix) instead of just blasting it
      // away entirely.
      this.fileCodec.op_deleteAll()
    );

    const schemaSpec   = this._schemaHandler.initSpec;
    const bodySpec     = this._bodyControl.initSpec;
    const caretSpec    = this._caretControl.initSpec;
    const propertySpec = this._propertyControl.initSpec;

    const result = eraseSpec
      .concat(schemaSpec)
      .concat(bodySpec)
      .concat(caretSpec)
      .concat(propertySpec);

    return result;
  }

  /**
   * Subclass-specific implementation of `afterInit()`. In this case, it runs
   * the `afterInit()` methods on each of the subcomponents.
   */
  async _impl_afterInit() {
    await Promise.all([
      this._schemaHandler.afterInit(),
      this._bodyControl.afterInit(),
      this._caretControl.afterInit(),
      this._propertyControl.afterInit()
    ]);
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}. This
   * class implements overall validation for all document pieces.
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    if (!(await this.file.exists())) {
      return ValidationStatus.STATUS_notFound;
    }

    const members = [
      this._schemaHandler,
      this._bodyControl,
      this._caretControl,
      this._propertyControl
    ];

    for (const member of members) {
      const status = await member.validationStatus();
      if (status !== ValidationStatus.STATUS_ok) {
        return status;
      }
    }

    return ValidationStatus.STATUS_ok;
  }

  /**
   * Main guts of `init()`, which is called while the init mutex is locked.
   *
   * @returns {boolean} `true` once setup and initialization are complete.
   */
  async _init() {
    this.log.info('Doing bootstrap-time validation...');
    const status  = await this.validationStatus();

    if (status === ValidationStatus.STATUS_ok) {
      // All's well.
      return true;
    }

    // The document needs to be initialized.

    let firstText;

    switch (status) {
      case ValidationStatus.STATUS_migrate: {
        // **TODO:** Ultimately, this code path will evolve into forward
        // migration of documents found to be in older formats. For now, we just
        // fall through to the document creation logic below, which will leave
        // a note what's going on in the document contents.
        this.log.info('Needs migration. (But just noting that fact for now.)');
        firstText = MIGRATION_NOTE;
        break;
      }

      case ValidationStatus.STATUS_recover: {
        // **TODO:** As with `STATUS_migrate`, this code path will eventually
        // expand into some sort of recovery mechanism.
        this.log.info('Needs recovery. (But just noting that fact for now.)');
        firstText = RECOVERY_NOTE;
        break;
      }

      case ValidationStatus.STATUS_error: {
        // **TODO:** Ultimately, it should be a Really Big Deal if we find
        // ourselves here. We might want to implement some form of "hail mary"
        // attempt to recover _something_ of use from the document storage.
        this.log.info('Major problem with stored data!');
        firstText = ERROR_NOTE;
        break;
      }

      case ValidationStatus.STATUS_notFound: {
        // The file simply didn't exist.
        this.log.info('Making new file.');
        firstText = DEFAULT_TEXT;
        break;
      }

      default: {
        throw Errors.wtf(`Weird status: ${status}`);
      }
    }

    // `revNum` is `1` because a newly-created body always has an empty
    // change for revision `0`.
    const change   = new BodyChange(1, firstText, Timestamp.now());
    const initSpec = this.initSpec;

    await this.file.create();
    await this.file.transact(initSpec);

    await this.afterInit();

    // **TODO:** Ideally, this would be rolled into the transaction as defined
    // by `initSpec` above.
    await this._bodyControl.update(change);

    return true;
  }

  /**
   * Checks that `init()` has been called, and complains with an error if not.
   */
  _initCheck() {
    if (!this._initialized) {
      throw Errors.badUse('Must be `init()`ed before access.');
    }
  }
}
