// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Storage } from '@bayou/config-server';
import { CaretId } from '@bayou/doc-common';
import { TBoolean } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import FileComplex from './FileComplex';

/**
 * Base class for the server-side representative of an access session for a
 * specific document, by a specific author, using a specific caret. Instances
 * of (concrete subclasses of) this class are exposed across an API boundary,
 * and as such all public methods are available for client use.
 */
export default class BaseSession extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex representing the underlying
   *   file for this instance to use.
   * @param {string} authorId The author this instance acts on behalf of.
   * @param {string} caretId Caret ID for this instance.
   * @param {boolean} canEdit Whether (`true`) or not (`false`) the instance is
   *   to allow editing to happen through it. That is, `false` indicates a
   *   view-only session.
   */
  constructor(fileComplex, authorId, caretId, canEdit) {
    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {string} Author ID. */
    this._authorId = Storage.dataStore.checkAuthorIdSyntax(authorId);

    /** {string} Caret ID. */
    this._caretId = CaretId.check(caretId);

    /** {boolean} Whether or not this instance allows edits. */
    this._canEdit = TBoolean.check(canEdit);

    // **TODO:** Remove this restriction!
    if (!canEdit) {
      throw Errors.wtf('View-only sessions not yet supported!');
    }

    /** {BodyControl} The underlying body content controller. */
    this._bodyControl = fileComplex.bodyControl;

    /** {CaretControl} The underlying caret info controller. */
    this._caretControl = fileComplex.caretControl;

    /** {PropertyControl} The underlying property (metadata) controller. */
    this._propertyControl = fileComplex.propertyControl;

    /** {Logger} Logger to use to relay events coming from the client. */
    this._clientLog = this._fileComplex.fileAccess.log.withAddedContext('client');
  }

  /**
   * {BodyControl} The underlying body content controller.
   *
   * This is intended for use by subclasses.
   */
  get bodyControl() {
    return this._bodyControl;
  }

  /** {CaretControl} The underlying caret info controller.
   *
   * This is intended for use by subclasses.
   */
  get caretControl() {
    return this._caretControl;
  }

  /** {PropertyControl} The underlying property (metadata) controller.
   *
   * This is intended for use by subclasses.
   */
  get propertyControl() {
    return this._propertyControl;
  }

  /**
   * Indicates whether (`true`) or not (`false`) this instance allows editing to
   * be performed through it.
   *
   * **Note:** This is a method and not just a property, specifically so that
   * clients (via the API) can make this determination.
   *
   * @returns {boolean} `true` if this instance allows editing, or `false` if it
   *   is view-only.
   */
  canEdit() {
    return this._canEdit;
  }

  /**
   * Standard (to this project) `deconstruct` method. This method is defined
   * here just so that instances can be stringified in a reasonable way (e.g.
   * when logging), and _not_ because they're expected to get transmitted over
   * an API boundary or stored in a DB.
   *
   * @returns {array<*>} "Reconstruction" arguments, suitable for logging.
   */
  deconstruct() {
    return [this.getLogInfo()];
  }

  /**
   * Returns a bit of identifying info about this instance, for the purposes of
   * logging. Specifically, the client will call this method and log the result
   * during session initiation.
   *
   * @returns {object} Succinct identification.
   */
  getLogInfo() {
    const result = {
      authorId:   this.getAuthorId(),
      caretId:    this.getCaretId(),
      documentId: this.getDocumentId(),
      fileId:     this.getFileId(),
      canEdit:    this.canEdit()
    };

    // Only include the file ID if it's not the same as the document ID.
    if (result.fileId === result.documentId) {
      delete result.fileId;
    }

    return result;
  }

  /**
   * Returns the author ID of the user managed by this session.
   *
   * @returns {string} The author ID.
   */
  getAuthorId() {
    return this._authorId;
  }

  /**
   * Returns the caret ID of this instance.
   *
   * @returns {string} The caret ID.
   */
  getCaretId() {
    return this._caretId;
  }

  /**
   * Returns the ID of the document controlled by this instance.
   *
   * @returns {string} The document ID.
   */
  getDocumentId() {
    return this._fileComplex.fileAccess.documentId;
  }

  /**
   * Returns the ID of the file controlled by this instance.
   *
   * @returns {string} The file ID.
   */
  getFileId() {
    return this._fileComplex.fileAccess.file.id;
  }

  /**
   * Causes an event (which will come from the client) to be logged here on the
   * server. This is useful for tactical debugging, moreso than intended for
   * long-term use.
   *
   * **TODO:** Consider removing this.
   *
   * @param {string} name The event name to log.
   * @param {...*} args Arbitrary arguments to log.
   */
  logEvent(name, ...args) {
    this._clientLog.event[name](...args);
  }
}
