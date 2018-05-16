// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { Hooks } from '@bayou/hooks-server';
import { Logger } from '@bayou/see-all';
import { TFunction, TString } from '@bayou/typecheck';
import { Singleton } from '@bayou/util-common';

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

    /** {Codec} Codec instance to use. */
    this._codec = appCommon_TheModule.fullCodec;

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
      // There's something in the cache. There are two possibilities...
      if (already instanceof Promise) {
        // It's a _promise_ for a `FileComplex`. This happens if we got a
        // request for a file in parallel with it getting constructed.
        const result = await already;
        result.log.info('Retrieved parallel-requested complex.');
        return result;
      } else {
        // It's a weak reference. If not dead, it refers to a `FileComplex`.
        if (!weak.isDead(already)) {
          const result = weak.get(already);
          result.log.info('Retrieved cached complex.');
          return result;
        }
        // The weak reference is dead. We'll fall through and construct a new
        // result.
        log.withAddedContext(docId).info('Cached complex was gc\'ed.');
      }
    }

    // Nothing in the cache (except, perhaps, a dead weak reference).
    // Asynchronously construct the ultimate result, returning a promise to it.

    const resultPromise = (async () => {
      try {
        const file   = await Hooks.theOne.fileStore.getFile(docId);
        const result = new FileComplex(this._codec, file);

        result.log.info('Initializing...');
        await result.init();
        result.log.info('Done initializing.');

        const resultRef = weak(result, this._complexReaper(docId));

        // Replace the promise in the cache with a weak reference to the actaul
        // result.
        this._complexes.set(docId, resultRef);

        result.log.info('Constructed new complex.');
        return result;
      } catch (e) {
        log.error(`Trouble constructing complex ${docId}.`, e);

        // Remove the promise in the cache, so that we will try again instead of
        // continuing to report this error.
        this._complexes.delete(docId);

        throw e; // Becomes the rejection value of the promise.
      }
    })();

    // Store the the promise for the result in the cache, and return it.

    log.withAddedContext(docId).info('About to construct complex.');
    this._complexes.set(docId, resultPromise);
    return resultPromise;
  }

  /**
   * Returns a weak reference callback function for the indicated document ID.
   *
   * @param {string} docId Document ID of the file complex to remove.
   * @returns {function} An appropriately-constructed function.
   */
  _complexReaper(docId) {
    // **Note:** This function _used to_ remove the doc binding from the
    // `_complexes` map on the presumption that it was a known-dead weak
    // reference. That code has been deleted. First of all, the only benefit
    // would have been that it meant that the weak reference itself could get
    // GC'ed (and a dead weakref doesn't actually take up significant storage).
    // Second, and more importantly, this could fail due to a race condition: If
    // the same doc was requested _after_ the old one was GC'ed and _before_
    // this reaper was called, the cleanup code here would have incorrectly
    // removed a perfectly valid binding.
    return () => {
      log.info('Reaped idle file complex:', docId);
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

      log.info('Reaped idle session:', sessionId);
    };
  }
}
