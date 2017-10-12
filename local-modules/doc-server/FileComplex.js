// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';
import { BodyDelta } from 'doc-common';
import { ProductInfo } from 'env-server';
import { BaseFile, FileCodec } from 'file-store';
import { DEFAULT_DOCUMENT } from 'hooks-server';
import { Mutex } from 'promise-util';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import CaretControl from './CaretControl';
import BodyControl from './BodyControl';
import DocServer from './DocServer';

/** {Logger} Logger to use for this module. */
const log = new Logger('doc');

/** {BodyDelta} Default contents when creating a new document. */
const DEFAULT_TEXT = BodyDelta.fromQuillForm(DEFAULT_DOCUMENT);

/**
 * {BodyDelta} Message used as document to indicate a major validation error.
 */
const ERROR_NOTE = BodyDelta.fromQuillForm([
  { insert: '(Recreated document due to validation error(s).)\n' }
]);

/**
 * {BodyDelta} Message used as document instead of migrating documents from
 * old schema versions. */
const MIGRATION_NOTE = BodyDelta.fromQuillForm([
  { insert: '(Recreated document due to schema version skew.)\n' }
]);

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

    /** {string} The document schema version to use and expect. */
    this._schemaVersion = TString.nonEmpty(ProductInfo.theOne.INFO.version);

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = new FileCodec(file, codec);

    /**
     * {BodyControl|null} Document body content controller. Set to non-`null` in
     * the corresponding getter.
     */
    this._bodyControl = null;

    /**
     * {CaretControl|null} Caret info controller. Set to non-`null` in the
     * corresponding getter.
     */
    this._caretControl = null;

    /** {Mutex} Mutex to avoid overlapping initialization operations. */
    this._initMutex = new Mutex();
  }

  /** {BodyControl} The body content controller to use with this instance. */
  get bodyControl() {
    if (this._bodyControl === null) {
      this._bodyControl = new BodyControl(this);
      this._log.info('Constructed body controller.');
    }

    return this._bodyControl;
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

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._file;
  }

  /** {FileCodec} File-codec wrapper to use. */
  get fileCodec() {
    return this._fileCodec;
  }

  /**
   * {Logger} Logger to use with this instance. It prefixes logged items with
   * the file's ID.
   */
  get log() {
    return this._log;
  }

  /**
   * {string} The document schema version to use for new documents and to expect
   * in existing documents.
   */
  get schemaVersion() {
    return this._schemaVersion;
  }

  /**
   * Initializes the document content, if either the file doesn't exist or the
   * content doesn't pass validation.
   *
   * @returns {undefined} `undefined` once setup and initialization are
   *   complete.
   */
  async initIfMissingOrInvalid() {
    return this._initMutex.withLockHeld(async () => {
      const control = this.bodyControl;
      const status  = await control.validationStatus();

      if (status === BodyControl.STATUS_OK) {
        // All's well.
        return;
      }

      // The document needs to be initialized.

      let firstText;

      if (status === BodyControl.STATUS_MIGRATE) {
        // **TODO:** Ultimately, this code path will evolve into forward
        // migration of documents found to be in older formats. For now, we just
        // fall through to the document creation logic below, which will leave
        // a note what's going on in the document contents.
        this.log.info('Needs migration. (But just noting that fact for now.)');
        firstText = MIGRATION_NOTE;
      } else if (status === BodyControl.STATUS_ERROR) {
        // **TODO:** Ultimately, it should be a Really Big Deal if we find
        // ourselves here. We might want to implement some form of "hail mary"
        // attempt to recover _something_ of use from the document storage.
        this.log.info('Major problem with stored data!');
        firstText = ERROR_NOTE;
      } else {
        // The document simply didn't exist.
        firstText = DEFAULT_TEXT;
      }

      await control.create(firstText);
    });
  }

  /**
   * Makes a new author-associated session for this instance.
   *
   * @param {string} authorId ID for the author.
   * @param {function} makeSessionId No-argument function which should return a
   *   randomly-generated string to use as a session ID. This will get called
   *   more than once if the string happens to be a duplicate in the namespace
   *   for session IDs.
   * @returns {DocSession} A newly-constructed session.
   */
  makeNewSession(authorId, makeSessionId) {
    return DocServer.theOne._makeNewSession(this, authorId, makeSessionId);
  }

  /**
   * Indicates that a particular session was reaped (GC'ed). This is a "friend"
   * method which gets called by `DocServer`.
   *
   * @param {string} sessionId ID of the session that got reaped.
   */
  async _sessionReaped(sessionId) {
    // Pass through to the caret controller (if present), since it might have a
    // record of the session.
    if (this._caretControl) {
      await this._caretControl._sessionReaped(sessionId);
    }
  }
}
