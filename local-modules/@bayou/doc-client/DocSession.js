// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from '@bayou/api-client';
import { BaseKey } from '@bayou/api-common';
import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import CaretTracker from './CaretTracker';
import PropertyClient from './PropertyClient';

/** Logger. */
const log = new Logger('doc');

/**
 * Manager of the API connection(s) needed to maintain a server session.
 */
export default class DocSession extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseKey} key Key that identifies the session and grants access to
   *   it. **Note:** A session is specifically tied to a specific caret, which
   *   is associated with a single document and a specific author.
   * @param {string|null} [authorToken = null] Token which identifies the author
   *   (user) under whose authority the session is run. This is only used if it
   *   is non-`null` _and_ `key` is `null`. **TODO:** This argument is ignored
   *   for now but will ultimately replace `key`.
   * @param {string|null} [documentId = null] ID of the document to be edited in
   *   this session. Only used if `authorToken` is being used (not if `key` is
   *   being used).
   * @param {string|null} [caretId = null] ID of a pre-existing caret to control
   *   with this instance. Only used if `authorToken` is being used (not if
   *   `key` is being used). If being used and `null`, a new caret will be
   *   created for this session.
   */
  constructor(key, authorToken, documentId, caretId) {
    super();

    /**
     * {BaseKey} Key that identifies the server-side session and grants access
     * to it.
     */
    this._key = BaseKey.check(key);

    /**
     * {string|null} Token which identifies the author (user) under whose
     * authority the session is run. `null` if {@link #_key} is being used.
     */
    this._authorToken = null;

    /**
     * {string|null} ID of the document to be edited in this session. `null` if
     * {@link #_key} is being used.
     */
    this._documentId = null;

    /**
     * {string|null} ID of the caret to be controlled in this session. `null` if
     * {@link #_key} is being used _or_ if a new caret needs to be created for
     * this instance.
     */
    this._caretId = null;

    if (this._key === null) {
      // **Note:** This clause can't possibly be run yet, because of the call to
      // `BaseKey.check()` above (which guarantees that `_key` is non-`null`).
      // That will change once the new session code is more fleshed out.
      // **TODO:** Consider performing more validation of these strings. If
      // they're problematic, we'll _eventually_ get errors back from the
      // server, but maybe it's better to know sooner.
      this._authorToken = TString.check(authorToken);
      this._documentId = TString.check(documentId);
      this._caretId = TString.orNull(caretId);
    }

    /** {Logger} Logger specific to this document's ID. */
    this._log = log.withAddedContext(key.id);

    /**
     * {ApiClient|null} API client instance. Set to non-`null` in the getter
     * `apiClient`.
     */
    this._apiClient = null;

    /**
     * {CaretTracker|null} Caret tracker for this session. Set to non-`null` in
     * the getter {@link #caretTracker}.
     */
    this._caretTracker = null;

    /**
     * {PropertyClient} Accessor (read and write) for the document properties
     * (metadata). Set to non-`null` in the getter {@link #propertyClient}.
     */
    this._propertyClient = null;

    /**
     * {Promise<Proxy>|null} Promise for the API session proxy. Set to
     * non-`null` in `getSessionProxy()`.
     */
    this._sessionProxyPromise = null;
  }

  /**
   * {Logger} Logger to use when handling operations related to this instance.
   * Logged messages include a reference to the session ID.
   */
  get log() {
    return this._log;
  }

  /**
   * {ApiClient} API client instance to use. This is always the same instance
   * for any given instance of this class. (That is, this value is never
   * updated.) The client is not guaranteed to be open at the time it is
   * returned; however, `open()` will have been called on it, which means that
   * it will at least be in the _process_ of opening.
   *
   * @returns {ApiClient} API client interface.
   */
  get apiClient() {
    if (this._apiClient === null) {
      log.detail('Opening API client...');
      this._apiClient = new ApiClient(this._key.url, appCommon_TheModule.fullCodec);

      (async () => {
        await this._apiClient.open();
        log.detail('API client open.');
      })();
    }

    return this._apiClient;
  }

  /**
   * {string|null} Token which identifies the author (user) under whose
   * authority the session is run. `null` if {@link #_key} is being used.
   */
  get authorToken() {
    return this._authorToken;
  }

  /**
   * {string|null} ID of the document to be edited in this session. `null` if
   * {@link #_key} is being used.
   */
  get documentId() {
    return this._documentId;
  }

  /**
   * {string|null} ID of the caret to be controlled in this session. `null` if
   * {@link #_key} is being used _or_ if a new caret needs to be created for
   * this instance.
   */
  get caretId() {
    return this._caretId;
  }

  /** {CaretTracker} Caret tracker for this session. */
  get caretTracker() {
    if (this._caretTracker === null) {
      this._caretTracker = new CaretTracker(this);
    }

    return this._caretTracker;
  }

  /** {BaseKey} The session key. */
  get key() {
    return this._key;
  }

  /** {PropertyClient} Property accessor this session. */
  get propertyClient() {
    if (this._propertyClient === null) {
      this._propertyClient = new PropertyClient(this);
    }

    return this._propertyClient;
  }

  /**
   * Returns a proxy for the the server-side session object. This will cause the
   * API client connection to be established if it is not already established or
   * opening. The return value from this method always resolves to the same
   * proxy instance, and it will only ever perform authorization for the session
   * the first time it is called.
   *
   * @returns {Proxy} A proxy for the server-side session.
   */
  async getSessionProxy() {
    if (this._sessionProxyPromise === null) {
      this._sessionProxyPromise = this.apiClient.authorizeTarget(this._key);

      // Log a note once the promise resolves.
      await this._sessionProxyPromise;
      this._log.info('Received session proxy.');
    }

    // **Note:** Because this is an `async` method, it's okay to return a
    // promise.
    return this._sessionProxyPromise;
  }
}
