// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta, Timestamp } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { DEFAULT_DOCUMENT } from 'hooks-server';
import { Mutex } from 'promise-util';
import { Errors } from 'util-common';

import BaseComplexMember from './BaseComplexMember';
import CaretControl from './CaretControl';
import BodyControl from './BodyControl';
import SchemaHandler from './SchemaHandler';

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
 * old schema versions. */
const MIGRATION_NOTE = new BodyDelta([
  ['text', '(Recreated document due to schema version skew.)\n']
]);

/**
 * Handler for the "bootstrap" setup of a file, including initializing new
 * files, validating existing files, and dealing with validation problems.
 */
export default class FileBootstrap extends BaseComplexMember {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

    /** {Mutex} Mutex to avoid overlapping initialization operations. */
    this._initMutex = new Mutex();

    /** {boolean} Whether or not initialization has been completed. */
    this._initialized = false;

    /** {BodyControl} Document body content controller. */
    this._bodyControl = new BodyControl(fileAccess);

    /** {CaretControl} Caret info controller. */
    this._caretControl = new CaretControl(fileAccess);

    /** {SchemaHandler} Schema (and migration) handler. */
    this._schemaHandler = new SchemaHandler(fileAccess);

    Object.seal(this);
  }

  /** {BodyControl} The body content controller to use with this instance. */
  get bodyControl() {
    if (!this._initialized) {
      throw Errors.bad_use('Must be `init()`ed before access.');
    }

    return this._bodyControl;
  }

  /** {CaretControl} The caret info controller to use with this instance. */
  get caretControl() {
    if (!this._initialized) {
      throw Errors.bad_use('Must be `init()`ed before access.');
    }

    return this._caretControl;
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
   * Main guts of `init()`, which is called while the init mutex is locked.
   *
   * @returns {boolean} `true` once setup and initialization are complete.
   */
  async _init() {
    const status  = await this._overallValidationStatus();

    if (status === SchemaHandler.STATUS_OK) {
      // All's well.
      return true;
    }

    // The document needs to be initialized.

    let firstText;

    if (status === SchemaHandler.STATUS_MIGRATE) {
      // **TODO:** Ultimately, this code path will evolve into forward
      // migration of documents found to be in older formats. For now, we just
      // fall through to the document creation logic below, which will leave
      // a note what's going on in the document contents.
      this.log.info('Needs migration. (But just noting that fact for now.)');
      firstText = MIGRATION_NOTE;
    } else if (status === SchemaHandler.STATUS_ERROR) {
      // **TODO:** Ultimately, it should be a Really Big Deal if we find
      // ourselves here. We might want to implement some form of "hail mary"
      // attempt to recover _something_ of use from the document storage.
      this.log.info('Major problem with stored data!');
      firstText = ERROR_NOTE;
    } else {
      // The document simply didn't exist.
      firstText = DEFAULT_TEXT;
    }

    // `revNum` is `1` because a newly-created body always has an empty
    // change for revision `0`.
    const change = new BodyChange(1, firstText, Timestamp.now());

    // **TODO:** The following should all happen in a single transaction.

    const eraseSpec = new TransactionSpec(
      // If the file already existed, this clears out the old contents.
      // **TODO:** In cases where this is a re-creation based on a migration
      // problem, we probably want to preserve the old data by moving it aside
      // (e.g. into a `lossage/<timestamp>` prefix) instead of just blasting it
      // away entirely.
      this.fileCodec.op_deleteAll()
    );

    const schemaSpec = this._schemaHandler.initSpec;
    const bodySpec   = this._bodyControl.initSpec;
    const fullSpec   = eraseSpec.concat(schemaSpec).concat(bodySpec);

    await this.file.create();
    await this.file.transact(fullSpec);

    await this._bodyControl.afterInit();
    await this._bodyControl.update(change);

    return true;
  }

  /**
   * Helper for `init()` which determines overall status based on checks from
   * the various file components.
   *
   * @returns {string} One of the `STATUS_*` constants defined by
   *   {@link SchemaHandler}.
   */
  async _overallValidationStatus() {
    const schemaStatus = await this._schemaHandler.validationStatus();

    if (schemaStatus !== SchemaHandler.STATUS_OK) {
      return schemaStatus;
    }

    return this._bodyControl.validationStatus();
  }
}
