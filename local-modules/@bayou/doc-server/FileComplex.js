// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseComplexMember from './BaseComplexMember';
import DocServer from './DocServer';
import FileAccess from './FileAccess';
import FileBootstrap from './FileBootstrap';

/**
 * Manager for the "complex" of objects which in aggregate allow access and
 * update to a file, for the purpose of managing it as an actively-edited
 * document.
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by `DocServer`.)
 */
export default class FileComplex extends BaseComplexMember {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec instance to use.
   * @param {BaseFile} file The underlying document storage.
   */
  constructor(codec, file) {
    super(new FileAccess(codec, file), 'complex');

    /**
     * {FileBootstrap} Bootstrap handler, and also where the complex members are
     * most directly stored.
     */
    this._bootstrap = new FileBootstrap(this._fileAccess);

    Object.freeze(this);
  }

  /** {BodyControl} The body content controller to use with this instance. */
  get bodyControl() {
    return this._bootstrap.bodyControl;
  }

  /** {CaretControl} The caret info controller to use with this instance. */
  get caretControl() {
    return this._bootstrap.caretControl;
  }

  /** {PropertyControl} The property controller to use with this instance. */
  get propertyControl() {
    return this._bootstrap.propertyControl;
  }

  /**
   * Initializes the document content.
   *
   * @returns {boolean} `true` once setup and initialization are complete.
   */
  async init() {
    return this._bootstrap.init();
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
    // Pass through to the caret controller, since it might have a record of the
    // session.
    await this.caretControl._sessionReaped(sessionId);
  }
}
