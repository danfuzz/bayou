// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Urls } from '@bayou/app-common';
import { Auth, Network, Storage } from '@bayou/config-server';
import { SessionInfo } from '@bayou/doc-common';
import { DocServer } from '@bayou/doc-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * {Int} How long to wait (in msec) in {@link #makeSessionInfo} while holding
 * a {@link FileComplex}, as a tactic to avoid overly-eager GC. See long comment
 * in that method for details.
 */
const COMPLEX_HOLD_TIME_MSEC = 10 * 1000; // One second.

/** Logger. */
const log = new Logger('root-access');

/**
 * "Root access" object. An instance of this class is what the root bearer
 * token(s) grant access to (along with whatever else is configured by the
 * hook {@link config-server.Deployment#rootAccess}).
 */
export class RootAccess extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {Map<string, BearerToken>} Map from author IDs to corresponding tokens,
     * as registered by {@link #useToken}.
     */
    this._tokenMap = new Map();

    Object.freeze(this);
  }

  /**
   * Makes an instance of {@link SessionInfo} which corresponds to a specific
   * author editing a specific document, on the server (or server cluster)
   * running this method.
   *
   * **Note:** This method checks the validity of the IDs via back-end requests
   * but does _not_ check to see if the author actually has permission to access
   * the identified document. That permission check will end up getting done
   * when the client comes back in through the "front door" and lands in a call
   * to {@link AuthorAccess#makeNewSession}.
   *
   * @param {string} authorId ID of the author (user) who will be driving the
   *   session.
   * @param {string} documentId ID of the document to be accessed.
   * @returns {SessionInfo} Corresponding info struct.
   */
  async makeSessionInfo(authorId, documentId) {
    log.event.sessionInfoRequested(authorId, documentId);

    // These checks round-trip with the back-end to do full (not just syntactic)
    // validation.
    await Promise.all([
      Storage.docStore.checkExistingAuthorId(authorId),
      Storage.docStore.checkExistingDocumentId(documentId)
    ]);

    // We'll need the file complex as soon as the client becomes active, so
    // might as well warm it up. But also, this ensures that the complex is in
    // at least a semblance of a valid state before we return the info to the
    // caller.
    const complex = await DocServer.theOne.getFileComplex(documentId);

    // This is a little bit of a hack: Immediately after the above call to get
    // the file complex returns, the complex _would_ be GC-able because there
    // are no live references to it, were we not to do anything more. But we
    // know that the reason we're in this method at all is because there's a
    // client about to try to access the document, so we want to actually ensure
    // the complex's liveness by the time that actually happens. So, what we do
    // is hold the complex for just a moment in an async block, which should
    // give the client enough time to come back and request it, at which point
    // it will no longer be garbage due to its active use on the client
    // connection.
    (async () => {
      await Delay.resolve(COMPLEX_HOLD_TIME_MSEC);
      if (complex.bodyControl === complex.caretControl) {
        // This should never actually be true. We just do this test as a tactic
        // to keep `complex` from being a dead variable during the wait.
        throw Errors.wtf('Different controls are equal?!');
      }
    })();

    const url         = Urls.apiUrlFromBaseUrl(Network.baseUrl);
    const authorToken = await this._getAuthorToken(authorId);
    const result      = new SessionInfo(url, authorToken, documentId);

    // Log using `logInfo` to avoid leaking the unredacted token to the logs.
    log.event.madeSessionInfo(result.logInfo);

    // **Note:** This returns the full token string to the caller, as it (the
    // client) will ultimately need to pass it back in full. (Usually it's a bad
    // idea to return unredacted tokens; this (kind of) case is the main
    // exception.)
    return result;
  }
  static get _loggingFor_makeSessionInfo() {
    return {
      args:   [true],
      result: false
    };
  }

  /**
   * Registers a token to use for the given author ID. When done, the registered
   * token is used in favor of calling {@link Auth#getAuthorToken}.
   *
   * @param {string} authorId The author ID.
   * @param {string} authorToken The corresponding author token.
   */
  useToken(authorId, authorToken) {
    TString.check(authorId);
    TString.check(authorToken);

    this._tokenMap.set(authorId, Auth.tokenFromString(authorToken));
  }
  static get _loggingFor_useToken() {
    return { args: [true, false] };
  }

  /**
   * Gets a token to use for the given author ID.
   *
   * @param {string} authorId The author ID.
   * @returns {BearerToken} The corresponding author token.
   */
  async _getAuthorToken(authorId) {
    TString.check(authorId);

    const found = this._tokenMap.get(authorId);

    return (found !== undefined)
      ? found
      : Auth.getAuthorToken(authorId);
  }
}
