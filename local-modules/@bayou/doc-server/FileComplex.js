// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Storage } from '@bayou/config-server';
import { CaretId } from '@bayou/doc-common';
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
   * @param {string} documentId ID of the document associated with this
   *   instance.
   * @param {BaseFile} file The underlying document storage.
   */
  constructor(codec, documentId, file) {
    super(new FileAccess(codec, documentId, file), 'complex');

    /**
     * {FileBootstrap} Bootstrap handler, and also where the complex members are
     * most directly stored.
     */
    this._bootstrap = new FileBootstrap(this._fileAccess);

    /**
     * {Map<string, Weak<DocSession>>} Map from caret IDs to corresponding
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
   * Finds and returns a session to control a pre-existing caret on the document
   * managed by this instance. More specifically, the caret has to exist in the
   * caret part of the file, but there doesn't have to already be a
   * {@link DocSession} object in this process which represents it.
   *
   * @param {string} authorId ID of the author.
   * @param {string} caretId ID of the caret.
   * @returns {DocSession} A session object to control the indicated
   *   pre-existing caret.
   * @throws {InfoError} Thrown with name `badId` specifically if the caret is
   *   not found (including if it exists but is controlled by a different
   *   author).
   */
  async findExistingSession(authorId, caretId) {
    // **Note:** We only need to validate syntax, because if we actually find
    // the session, we can match the author ID and (if it does match) know that
    // the author really exists and is valid.
    Storage.dataStore.checkAuthorIdSyntax(authorId);

    CaretId.check(caretId);

    const foundWeak = this._sessions.get(caretId);

    if (foundWeak) {
      // Found in cache.
      if (weak.isDead(foundWeak)) {
        // ...but it's since been reaped. Fall through and search for the caret
        // in the snapshot for same.
        this.log.event.foundDead(authorId, caretId);
      } else {
        // We've seen cases where a weakly-referenced object gets collected
        // and replaced with an instance of a different class. If this check
        // throws an error, that's what's going on here. (This is evidence of
        // a bug in Node or in the `weak` package.)
        const foundSession = DocSession.check(weak.get(foundWeak));

        if (authorId === foundSession.getAuthorId()) {
          // We found a pre-existing session for the caret, and the author ID
          // matches. Bingo!
          return foundSession;
        } else {
          // Existing caret but wrong author ID for it. Log it (could be useful
          // in identifying a malicious actor or just a bug), but report it back
          // to the caller as simply an invalid ID.
          this.log.event.authorCaretMismatch(authorId, caretId);
          throw Errors.badId(caretId);
        }
      }
    }

    // There was no pre-existing session object, so we need to inspect the
    // carets and see if there is a record of the session. If so, and if the
    // author matches, we create and return the corresponding object.

    const caretSnapshot = await this.caretControl.getSnapshot();
    const foundCaret = caretSnapshot.getOrNull(caretId);

    if (foundCaret === null) {
      throw Errors.badId(caretId);
    } else if (foundCaret.authorId !== authorId) {
      // See comment above on similar logging and error.
      this.log.event.authorCaretMismatch(authorId, caretId);
      throw Errors.badId(caretId);
    }

    return this._activateSession(authorId, caretId);
  }

  /**
   * Makes and returns a new session for the document controlled by this
   * instance, which allows the indicated author to control a newly-instantiated
   * caret.
   *
   * @param {string} authorId ID for the author.
   * @returns {DocSession} A newly-constructed session.
   */
  async makeNewSession(authorId) {
    const timeoutTime = Date.now() + MAKE_SESSION_TIMEOUT_MSEC;

    // This validates the ID with the back end.
    await Storage.dataStore.checkExistingAuthorId(authorId);

    for (;;) {
      if (Date.now() >= timeoutTime) {
        throw Errors.timedOut(MAKE_SESSION_TIMEOUT_MSEC);
      }

      // Establish a new caret in the document, by creating and appending a
      // change from the instantaneously-latest carets.

      const caretSnapshot  = await this.caretControl.getSnapshot();
      const caretId        = caretSnapshot.randomUnusedId();
      const newCaretChange = await this.caretControl.changeForNewCaret(caretId, authorId);

      this.log.info(`Current caret snapshot revNum: ${caretSnapshot.revNum}`);
      this.log.event.establishingNewCaret(authorId, caretId, newCaretChange.revNum);

      const appendResult = await this.caretControl.appendChange(newCaretChange);

      if (appendResult) {
        // There was no append race, or we won it.
        this.log.event.establishedNewCaret(authorId, caretId, newCaretChange.revNum);
        return this._activateSession(authorId, caretId);
      }

      // We lost an append race, but the session introduction might still be
      // valid, so loop and try again (until timeout).
    }
  }

  /**
   * Helper for {@link #makeNewSession} and {@link #findExistingSession}, which
   * does the final setup of a new {@link DocSession} instance.
   *
   * @param {string} authorId ID of the author.
   * @param {string} caretId ID of the caret.
   * @returns {DocSession} A newly-constructed session.
   */
  _activateSession(authorId, caretId) {
    const result = new DocSession(this, authorId, caretId);
    const reaper = this._sessionReaper(caretId);
    const fileId = this.file.id;

    this._sessions.set(caretId, weak(result, reaper));

    this.log.event.sessionNowActive({ fileId, authorId, caretId });

    return result;
  }

  /**
   * Returns a weak reference callback function which reaps the
   * {@link DocSession} associated with the indicate caret.
   *
   * **Note:** This does _not_ remove the caret info from the carets part of
   * the document: Even though the session has become idle from the perspective
   * of this server, the caret isn't necessarily totally idle / dead. For
   * example, it might be the case that the client for the session happened to
   * end up connecting to a different machine and is continuing to putter away
   * at it.
   *
   * @param {string} caretId ID of the caret whose associated session is to be
   *   removed.
   * @returns {function} An appropriately-constructed function.
   */
  _sessionReaper(caretId) {
    return () => {
      this._sessions.delete(caretId);
      this.log.event.reapedIdleSession(caretId);
    };
  }
}
