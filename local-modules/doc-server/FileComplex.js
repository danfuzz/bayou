// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';
import { BaseFile } from 'content-store';
import { FrozenDelta } from 'doc-common';
import { DEFAULT_DOCUMENT } from 'hooks-server';
import { Logger } from 'see-all';
import { ProductInfo } from 'server-env';
import { TString } from 'typecheck';
import { CommonBase, PromMutex } from 'util-common';

import CaretControl from './DocControl';
import DocControl from './DocControl';

/** {Logger} Logger to use for this module. */
const log = new Logger('doc');

/** {FrozenDelta} Default contents when creating a new document. */
const DEFAULT_TEXT = FrozenDelta.coerce(DEFAULT_DOCUMENT);

/**
 * {FrozenDelta} Message used as document to indicate a major validation error.
 */
const ERROR_NOTE = FrozenDelta.coerce(
  [{ insert: '(Recreated document due to validation error(s).)\n' }]);

/**
 * {FrozenDelta} Message used as document instead of migrating documents from
 * old format versions. */
const MIGRATION_NOTE = FrozenDelta.coerce(
  [{ insert: '(Recreated document due to format version skew.)\n' }]);

/**
 * Manager for the "complex" of objects which in aggregate allow access and
 * update to a file, for the purpose of managing it as an actively-edited
 * document.
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by `DocServer`.)
 */
export default class FileComplex extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec instance to use.
   * @param {BaseFile} file The underlying document storage.
   */
  constructor(codec, file) {
    super();

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /** {BaseFile} The underlying document storage. */
    this._file = BaseFile.check(file);

    /** {Logger} Logger for this instance. */
    this._log = log.withPrefix(`[${file.id}]`);

    /** {string} The document format version to use and expect. */
    this._formatVersion = TString.nonempty(ProductInfo.theOne.INFO.version);

    /**
     * {CaretControl|null} Caret info controller. Set to non-`null` in the
     * corresponding getter.
     */
    this._caretControl = null;

    /**
     * {DocControl|null} Document content controller. Set to non-`null` in the
     * corresponding getter.
     */
    this._docControl = null;

    /** {PromMutex} Mutex to avoid overlapping initialization operations. */
    this._initMutex = new PromMutex();
  }

  /** {CaretControl} The caret info controller to use with this instance. */
  get caretControl() {
    if (this._caretControl === null) {
      this._caretControl = new CaretControl(this);
      this._log.info('Constructed caret controller.');
    }

    return this._caretControl;
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._codec;
  }

  /** {DocControl} The document controller to use with this instance. */
  get docControl() {
    if (this._docControl === null) {
      this._docControl = new DocControl(this);
      this._log.info('Constructed document controller.');
    }

    return this._docControl;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._file;
  }

  /**
   * {string} The document format version to use for new documents and to expect
   * in existing documents.
   */
  get formatVersion() {
    return this._formatVersion;
  }

  /**
   * {Logger} Logger to use with this instance. It prefixes logged items with
   * the file's ID.
   */
  get log() {
    return this._log;
  }

  /**
   * Initializes the document content, if either the file doesn't exist or the
   * content doesn't pass validation.
   */
  async initIfMissingOrInvalid() {
    const unlock = await this._initMutex.lock();
    try {
      const control   = this.docControl;
      const status    = await control.validationStatus();
      const needsInit = (status !== DocControl.STATUS_OK);
      let   firstText = DEFAULT_TEXT;

      if (status === DocControl.STATUS_MIGRATE) {
        // **TODO:** Ultimately, this code path will evolve into forward
        // migration of documents found to be in older formats. For now, we just
        // fall through to the document creation logic below, which will leave
        // a note what's going on in the document contents.
        this.log.info('Needs migration. (But just noting that fact for now.)');
        firstText = MIGRATION_NOTE;
      } else if (status === DocControl.STATUS_ERROR) {
        // **TODO:** Ultimately, it should be a Really Big Deal if we find
        // ourselves here. We might want to implement some form of "hail mary"
        // attempt to recover _something_ of use from the document storage.
        this.log.info('Major problem with stored data!');
        firstText = ERROR_NOTE;
      }

      if (needsInit) {
        await control.create(firstText);
      }
    } finally {
      unlock();
    }
  }
}
