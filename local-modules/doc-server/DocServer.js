// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Codec } from 'codec';
import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { TFunction, TString } from 'typecheck';
import { Singleton } from 'util-common';

import DocSession from './DocSession';
import FileComplex from './FileComplex';

/** {Logger} Logger for this module. */
const log = new Logger('doc-server');

/**
 * Interface between this module and the storage layer. This class is
 * responsible for instantiating and tracking `BodyControl` instances, such that
 * only one instance is created per actual document.
 *
 * This class is notably responsible for the lifecycle management of
 * document-related objects, in particular making sure that such objects have
 * an opportunity to get GC'ed once they're no longer in active use.
 */
export default class DocServer extends Singleton {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /**
     * {Codec} Codec instance to use. **Note:** As of this writing, `Codec` is a
     * singleton, but the intention is for it to stop being so.
     */
    this._codec = Codec.theOne;

    /**
     * {Map<string, Weak<FileComplex>|Promise<FileComplex>>} Map from document
     * IDs to either a weak-reference or a promise to a `FileComplex`, for the
     * so-IDed document. During asynchrounous construction, the binding is to a
     * promise, and once constructed it becomes a weak reference. The weak
     * reference is made because we don't want its presence here to preclude it
     * from getting GC'ed.
     */
    this._complexes = new Map();

    /**
     * {Map<string, Weak<DocSession>>} Map from session IDs to corresponding
     * weak-reference-wrapped `DocSession` instances. See `_complexes` for
     * rationale on weakness.
     */
    this._sessions = new Map();
  }

  /**
   * Gets the `FileComplex` for the document with the given ID. It is okay (not
   * an error) if the underlying file doesn't happen to exist.
   *
   * @param {string} docId The document ID.
   * @returns {FileComplex} The corresponding `FileComplex`.
   */
  async getFileComplex(docId) {
    TString.nonEmpty(docId);

    // Look for a cached or in-progress result.

    const already = this._complexes.get(docId);
    if (already) {
      // There's something in the cache...
      if (weak.isWeakRef(already)) {
        // It's a weak reference. If not dead, it refers to a `FileComplex`.
        if (!weak.isDead(already)) {
          const result = weak.get(already);
          result.log.info('Retrieved cached complex.');
          return result;
        }
        // else, it's a dead reference. We'll fall through and construct a
        // new result.
      } else {
        // It's actually a _promise_ for a `FileComplex`. This happens if we
        // got a request for a file in parallel with it getting constructed.
        const result = await already;
        result.log.info('Retrieved parallel-requested complex.');
        return result;
      }
    }

    // Nothing in the cache. Asynchronously construct the ultimate result.

    const resultPromise = (async () => {
      const file      = await Hooks.theOne.fileStore.getFile(docId);
      const result    = new FileComplex(this._codec, file);
      const resultRef = weak(result, this._complexReaper(docId));

      // Replace the promise in the cache with a weak reference to the actaul
      // result.
      this._complexes.set(docId, resultRef);

      result.log.info('Constructed new complex.');
      return result;
    })();

    // Store the the promise for the result in the cache, and return it.

    this._complexes.set(docId, resultPromise);
    return resultPromise;
  }

  /**
   * Gets the session with the given ID, if it exists.
   *
   * @param {string} sessionId The session ID in question.
   * @returns {DocSession|null} Corresponding session instance, or `null` if
   *   there is no such session.
   */
  getSessionOrNull(sessionId) {
    TString.nonEmpty(sessionId);

    const already = this._sessions.get(sessionId);

    if (already && !weak.isDead(already)) {
      return weak.get(already);
    } else {
      return null;
    }
  }

  /**
   * Returns a weak reference callback function for the indicated document ID,
   * that removes a collected file complex from the map of same.
   *
   * @param {string} docId Document ID of the file complex to remove.
   * @returns {function} An appropriately-constructed function.
   */
  _complexReaper(docId) {
    return () => {
      this._complexes.delete(docId);
      log.info(`Reaped idle file complex: ${docId}`);
    };
  }

  /**
   * Makes and returns a new author-tied session. This is a "friend" method to
   * the public `FileComplex` method of the same(ish) name, which is where this
   * functionality is exposed.
   *
   * @param {FileComplex} fileComplex Main complex to attach to.
   * @param {string} authorId ID for the author.
   * @param {function} makeSessionId Function to generate a random session ID.
   * @returns {DocSession} A newly-constructed session.
   */
  _makeNewSession(fileComplex, authorId, makeSessionId) {
    FileComplex.check(fileComplex);
    TString.nonEmpty(authorId);
    TFunction.checkCallable(makeSessionId);

    // Make a unique session ID.
    let sessionId;
    for (;;) {
      sessionId = makeSessionId();
      if (!this._sessions.get(sessionId)) {
        break;
      }

      // We managed to get an ID collision. Unlikely, but it can happen. So,
      // just iterate and try again.
    }

    const result = new DocSession(fileComplex, sessionId, authorId);
    const reaper = this._sessionReaper(fileComplex, sessionId);

    this._sessions.set(sessionId, weak(result, reaper));
    return result;
  }

  /**
   * Returns a weak reference callback function for the indicated complex /
   * session pair, that removes a collected session object from the session map
   * and informs the associated file complex.
   *
   * @param {FileComplex} fileComplex File complex the session was used with.
   * @param {string} sessionId ID of the session to remove.
   * @returns {function} An appropriately-constructed function.
   */
  _sessionReaper(fileComplex, sessionId) {
    return async () => {
      this._sessions.delete(sessionId);

      try {
        await fileComplex._sessionReaped(sessionId);
      } catch (e) {
        // Ignore the error, except to report it.
        log.error(`Trouble reaping session ${sessionId}.`, e);
      }

      log.info(`Reaped idle session: ${sessionId}`);
    };
  }
}
