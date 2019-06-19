// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Storage } from '@bayou/config-server';
import { TBoolean, TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import { BaseComplexMember } from './BaseComplexMember';
import { EditSession } from './EditSession';
import { FileAccess } from './FileAccess';
import { FileBootstrap } from './FileBootstrap';
import { SessionCache } from './SessionCache';
import { ViewSession } from './ViewSession';

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
export class DocComplex extends BaseComplexMember {
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
    this._bootstrap = new FileBootstrap(this.fileAccess);

    /** {SessionCache} Cache of session instances, mapped from caret IDs. */
    this._sessions = new SessionCache(this.fileAccess.log);

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
   * Gets stats about the resource consumption managed by this instance, in the
   * form of an ad-hoc plain object. This information is used as part of the
   * high-level "load factor" metric calculation.
   *
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range for {@link BaseFile}. `null` is treated as the maximum allowed
   *   value.
   * @returns {object} Ad-hoc plain object with resource consumption stats.
   */
  async currentResourceConsumption(timeoutMsec = null) {
    const sessionCount = this._sessions.size;

    const [fileRevNum, fileSnapshot, bodyRevNum, bodySnapshot] = await Promise.all([
      this.file.currentRevNum(timeoutMsec),
      this.file.getSnapshot(null, timeoutMsec),
      this.bodyControl.currentRevNum(timeoutMsec),
      this.bodyControl.getSnapshot(null, timeoutMsec)
    ]);

    // The following is a very ad-hoc heuristic to get a sense of the
    // "largeness" of a file. See docs for any of the `.roughSize` properties
    // for a little more color.
    const roughSize =
        (fileRevNum * 15)
      + (fileSnapshot.roughSize * 2)
      + (bodyRevNum * 25)
      + (bodySnapshot.roughSize * 4);

    return { roughSize, sessionCount };
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
   * {@link BaseSession} object in this process which represents it.
   *
   * @param {string} authorId ID of the author.
   * @param {string} caretId ID of the caret.
   * @param {boolean} canEdit `true` if the session is to allow changes to be
   *   made through it, or `false` if not (that is, `false` for a view-only
   *   session).
   * @returns {BaseSession} A session object to control the indicated
   *   pre-existing caret.
   * @throws {InfoError} Thrown with name `badId` specifically if the caret is
   *   not found (including if it exists but is controlled by a different
   *   author).
   */
  async findExistingSession(authorId, caretId, canEdit) {
    TString.check(authorId); // Basic type check.
    TString.check(caretId);  // Basic type check.
    TBoolean.check(canEdit);

    // **Note:** We only need to validate syntax, because if we actually find
    // the session, we can match the author ID and (if it does match) know that
    // the author really exists and is valid.
    Storage.docStore.checkAuthorIdSyntax(authorId);

    const already = this._sessions.getOrNull(caretId);

    if (already !== null) {
      // We found a pre-existing session for the caret...
      if (authorId !== already.getAuthorId()) {
        // Wrong author, though. Log it (could be useful in identifying a
        // malicious actor or just a bug), but report it back to the caller as
        // simply an invalid ID.
        this.log.event.authorCaretMismatch(authorId, caretId);
        throw Errors.badId(caretId);
      } else if (canEdit !== already.canEdit()) {
        // Editability is different. What probably happened is that permissions
        // changed between when the session was first set up and now. Log it
        // (as it's at least mildly interesting), and then just fall through and
        // let a new properly-permissioned session get created.
        this.log.event.canEditMismatch(canEdit);
      } else {
        // The session looks good. Yay!
        return already;
      }
    }

    // There was no pre-existing session object, so we need to inspect the
    // carets and see if there is a record of the session. If so, and if the
    // author matches, we create and return the corresponding object.

    const caretSnapshot = await this.caretControl.getSnapshot();
    const foundCaret    = caretSnapshot.getOrNull(caretId);

    if (foundCaret === null) {
      throw Errors.badId(caretId);
    } else if (foundCaret.authorId !== authorId) {
      // See comment above on similar logging and error.
      this.log.event.authorCaretMismatch(authorId, caretId);
      throw Errors.badId(caretId);
    }

    return this._activateSession(authorId, caretId, canEdit);
  }

  /**
   * Makes and returns a new session for the document controlled by this
   * instance, which allows the indicated author to control a newly-instantiated
   * session. Depending on the value of `canEdit`, the session will (`true`) or
   * won't (`false`) allow editing operations to happen through it.
   *
   * @param {string} authorId ID for the author.
   * @param {boolean} canEdit `true` if the session is to allow changes to be
   *   made through it, or `false` if not (that is, `false` for a view-only
   *   session).
   * @returns {BaseSession} A newly-constructed session.
   */
  async makeNewSession(authorId, canEdit) {
    TString.check(authorId); // Basic type check.
    TBoolean.check(canEdit);

    const timeoutTime = Date.now() + MAKE_SESSION_TIMEOUT_MSEC;

    // This validates the ID with the back end.
    await Storage.docStore.checkExistingAuthorId(authorId);

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
        return this._activateSession(authorId, caretId, canEdit);
      }

      // We lost an append race, but the session introduction might still be
      // valid, so loop and try again (until timeout).
    }
  }

  /**
   * Helper for {@link #makeNewSession} and {@link #findExistingSession}, which
   * does the final setup of a new session instance.
   *
   * @param {string} authorId ID of the author.
   * @param {string} caretId ID of the caret.
   * @param {boolean} canEdit `true` if the session is to allow changes to be
   *   made through it, or `false` if not (that is, `false` for a view-only
   *   session).
   * @returns {BaseSession} A newly-constructed session.
   */
  _activateSession(authorId, caretId, canEdit) {
    const result = canEdit
      ? new EditSession(this, authorId, caretId)
      : new ViewSession(this, authorId, caretId);
    const fileId = this.file.id;

    this._sessions.add(result);
    this.log.event.sessionNowActive({ fileId, authorId, caretId });

    return result;
  }
}
