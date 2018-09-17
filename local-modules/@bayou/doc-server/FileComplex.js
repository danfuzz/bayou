// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Storage } from '@bayou/config-server';
import { TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import BaseComplexMember from './BaseComplexMember';
import DocSession from './DocSession';
import FileAccess from './FileAccess';
import FileBootstrap from './FileBootstrap';

/**
 * {Int} Maximum amount of time (in msec) to allow for the creation of new
 * sessions.
 */
const MAKE_SESSION_TIMEOUT_MSEC = 10 * 1000; // Ten seconds.

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

    /**
     * {Map<string, Weak<DocSession>>} Map from session IDs to corresponding
     * weak-reference-wrapped {@link DocSession} instances. The weak reference
     * is made because we don't want a session's presence in the map to keep it
     * from getting GC'ed. And we _need_ the map here, so that we can find
     * existing active sessions.
     */
    this._sessions = new Map();

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
   * Finds and returns a pre-existing session for this instance. More
   * specifically, the session has to exist in the caret part of the file, but
   * there doesn't have to already be a {@link DocSession} object in this
   * process which represents it.
   *
   * @param {string} authorId ID for the author.
   * @param {string} sessionId ID for the session.
   * @returns {DocSession} A session object representing the so-identified
   *   session.
   */
  async findExistingSession(authorId, sessionId) {
    // **Note:** We only need to validate syntax, because if we actually find
    // the session, we can match the author ID and (if it does match) know that
    // the author really exists and is valid.
    Storage.dataStore.checkAuthorIdSyntax(authorId);

    TString.nonEmpty(sessionId);

    const foundWeak = this._sessions.get(sessionId);
    if ((foundWeak !== undefined) && !weak.isDead(foundWeak)) {
      const foundSession = weak.get(foundWeak);
      if (foundSession instanceof DocSession) {
        // There is already a `DocSession` for the given session ID.
        if (authorId === foundSession.getAuthorId()) {
          // ...and the author ID matches. Bingo!
          return foundSession;
        } else {
          throw Errors.badUse(`Wrong author ID for session: author ID \`${authorId}\`; session ID \`${sessionId}\``);
        }
      }
    }

    // There was no pre-existing session object, so we need to inspect the
    // carets and see if there is a record of the session. If so, and if the
    // author matches, we create and return the corresponding object.

    const caretSnapshot = await this.caretControl.getSnapshot();
    const foundCaret    = caretSnapshot.get(sessionId); // This throws if the session isn't found.

    if (foundCaret.authorId !== authorId) {
      throw Errors.badUse(`Wrong author ID for session: author ID \`${authorId}\`; session ID \`${sessionId}\``);
    }

    return this._activateSession(authorId, sessionId);
  }

  /**
   * Makes a new author-associated session for this instance.
   *
   * @param {string} authorId ID for the author.
   * @param {string} sessionId ID for the session.
   * @returns {DocSession} A newly-constructed session.
   */
  async makeNewSession(authorId, sessionId) {
    const timeoutTime = Date.now() + MAKE_SESSION_TIMEOUT_MSEC;

    // This validates the ID with the back end.
    await Storage.dataStore.checkExistingAuthorId(authorId);

    TString.nonEmpty(sessionId);

    for (;;) {
      if (Date.now() >= timeoutTime) {
        throw Errors.timedOut(timeoutTime);
      }

      // Ensure that the session ID doesn't correspond to a pre-existing
      // session.

      const caretSnapshot = await this.caretControl.getSnapshot();
      const already       = caretSnapshot.getOrNull(sessionId);

      if (already !== null) {
        throw Errors.badUse(`Attempt to create session with already-used ID: \`${sessionId}\``);
      }

      // Establish the new session, as a change from the instantaneously-latest
      // carets.

      const newSessionChange =
        await this.caretControl.changeForNewSession(sessionId, authorId);
      const appendResult = await this.caretControl.appendChange(newSessionChange);

      if (appendResult) {
        // There was no append race, or we won it.
        break;
      }

      // We lost an append race, but the session introduction might still be
      // valid, so loop and try again (until timeout).
    }

    return this._activateSession(authorId, sessionId);
  }

  /**
   * Helper for {@link #makeNewSession} and {@link #findExistingSession}, which
   * does the final setup of a new {@link DocSession} instance.
   *
   * @param {string} authorId ID for the author.
   * @param {string} sessionId ID for the session.
   * @returns {DocSession} A newly-constructed session.
   */
  _activateSession(authorId, sessionId) {
    const result = new DocSession(this, authorId, sessionId);
    const reaper = this._sessionReaper(sessionId);

    this._sessions.set(sessionId, weak(result, reaper));

    this.log.info(
      `Session ${sessionId} now active.\n`,
      `  file:    ${this.file.id}\n`,
      `  author:  ${authorId}\n`);

    return result;
  }

  /**
   * Returns a weak reference callback function for the indicated complex /
   * session pair, that removes a collected session object from the session map.
   *
   * **Note:** This does _not_ remove the session info from the carets part of
   * the document: Even though the session has become idle from the perspective
   * of this server, the session isn't necessarily totally idle / dead. For
   * example, it might be the case that the client for the session happened to
   * end up connecting to a different machine and is continuing to putter away
   * at it.
   *
   * @param {string} sessionId ID of the session to remove.
   * @returns {function} An appropriately-constructed function.
   */
  _sessionReaper(sessionId) {
    return () => {
      this._sessions.delete(sessionId);
      this.log.info('Reaped idle session:', sessionId);
    };
  }
}
