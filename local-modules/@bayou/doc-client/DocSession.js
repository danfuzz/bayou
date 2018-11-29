// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from '@bayou/api-client';
import { BaseKey } from '@bayou/api-common';
import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { SessionInfo } from '@bayou/doc-common';
import { Logger } from '@bayou/see-all';
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
   * @param {BaseKey|SessionInfo|null} keyOrInfo Key or info object that
   *   identifies the session and grants access to it. **Note:** A session is
   *   tied to a specific caret, which is associated with a single document and
   *   author. If passed a `SessionInfo` without a caret ID, then the act of
   *   establishing the session will cause a new caret to be created. If `null`,
   *   the remaining arguments are used to construct a `SessionInfo`.
   * @param {string|null} [authorToken = null] `SessionInfo` constructor
   *   argument. **TODO:** Remove this once call sites consistently pass a
   *   `SessionInfo`.
   * @param {string|null} [documentId = null] `SessionInfo` constructor
   *   argument. **TODO:** Remove this once call sites consistently pass a
   *   `SessionInfo`.
   * @param {string|null} [caretId = null] `SessionInfo` constructor argument.
   *   **TODO:** Remove this once call sites consistently pass a `SessionInfo`.
   */
  constructor(keyOrInfo, authorToken = null, documentId = null, caretId = null) {
    super();

    // **TODO:** Remove this when the extra arguments are removed.
    if (keyOrInfo === null) {
      keyOrInfo = new SessionInfo('http://localhost:8080/api', authorToken, documentId, caretId);
    }

    /**
     * {SessionInfo} Identifying and authorizing information for the session.
     * If `null`, then {@link #_key} is being used instead of this.
     */
    this._sessionInfo = (keyOrInfo instanceof SessionInfo) ? keyOrInfo : null;

    /**
     * {BaseKey|null} Key that identifies the server-side session and grants
     * access to it. If `null`, then {@link #_sessionInfo} is being used
     * instead of this.
     */
    this._key = (this._sessionInfo === null) ? BaseKey.check(keyOrInfo) : null;

    /**
     * {Logger} Maximally-specific logger. **TODO:** Because {@link
     * #_sessionInfo} might not have a caret ID but the session will
     * _eventually_ have one, it probably doesn't make sense to have this
     * defined in this class.
     */
    this._log = (this._key !== null)
      ? log.withAddedContext(this._key.id)
      : log.withAddedContext(this._sessionInfo.logTag);

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

    Object.seal(this);
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
    const url = (this._sessionInfo !== null)
      ? this._sessionInfo.serverUrl
      : this._key.url;

    if (this._apiClient === null) {
      this._log.event.opening(url);
      this._apiClient = new ApiClient(url, appCommon_TheModule.fullCodec);

      (async () => {
        try {
          await this._apiClient.open();
          this._log.event.opened(url);
        } catch (e) {
          // (a) Log the problem, and (b) make sure an error doesn't percolate
          // back to the top as an uncaught promise rejection.
          this._log.event.openFailed(url);
        }
      })();
    }

    return this._apiClient;
  }

  /** {CaretTracker} Caret tracker for this session. */
  get caretTracker() {
    if (this._caretTracker === null) {
      this._caretTracker = new CaretTracker(this);
    }

    return this._caretTracker;
  }

  /**
   * {BaseKey|SessionInfo} Information which was originally used to construct
   * this instance. Used for recovery from connection trouble.
   *
   * **TODO:** This should be removed and its use sites switched to
   * `.sessionInfo`, once key-based session setup is retired.
   */
  get keyOrInfo() {
    return this._key || this._sessionInfo;
  }

  /** {PropertyClient} Property accessor this session. */
  get propertyClient() {
    if (this._propertyClient === null) {
      this._propertyClient = new PropertyClient(this);
    }

    return this._propertyClient;
  }

  /**
   * {SessionInfo|null} Information which identifies and authorizes the session,
   * or `null` if this instance was constructed with a `SplitKey`.
   */
  get sessionInfo() {
    return this._sessionInfo;
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
    if (this._sessionProxyPromise !== null) {
      // **Note:** Because this is an `async` method, it's okay to return a
      // promise.
      return this._sessionProxyPromise;
    }

    let proxyPromise;

    if (this._sessionInfo !== null) {
      const info        = this._sessionInfo;
      const api         = this._apiClient;
      const authorProxy = api.getProxy(info.authorToken);

      if (info.caretId === null) {
        proxyPromise = authorProxy.makeNewSession(info.documentId);
      } else {
        proxyPromise = authorProxy.findExistingSession(info.documentId, info.caretId);
      }
    } else {
      // **TODO:** Remove the `if` and this clause once {@link #_sessionInfo}
      // is used ubiquitously.
      proxyPromise = this.apiClient.authorizeTarget(this._key);
    }

    this._sessionProxyPromise = proxyPromise;

    // Log a note once the promise resolves.
    const proxy = await proxyPromise;
    this._log.event.gotSessionProxy();

    if (this._sessionInfo !== null) {
      const info = this._sessionInfo;

      if (info.caretId === null) {
        // The session got started without a caret ID, which means a new caret
        // will have been created. Update `_sessionInfo` accordingly.
        const caretId = await proxy.getCaretId();

        this._sessionInfo = info.withCaretId(caretId);
        this._log.event.gotCaret(caretId);
      }
    }

    return proxy;
  }
}
