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
     * {ApiClient|null} API client instance. Set to non-`null` in
     * {@link #_getApiClient}.
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
     * non-`null` in {@link #getSessionProxy}.
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
    const api = this._getApiClient();

    if (this._sessionProxyPromise !== null) {
      const proxy = await this._sessionProxyPromise;

      if (api.handles(proxy)) {
        // The session proxy we already had is still apparently valid, so it's
        // safe to return it.
        this._log.event.sessionStillValid();
        return proxy;
      }

      // Fall through to re-set-up the session.
      this._log.event.mustReestablishSession();
    }

    let proxyPromise;

    if (this._sessionInfo !== null) {
      const info        = this._sessionInfo;
      const authorProxy = api.getProxy(info.authorToken);

      if (info.caretId === null) {
        proxyPromise = authorProxy.makeNewSession(info.documentId);
      } else {
        proxyPromise = authorProxy.findExistingSession(info.documentId, info.caretId);
      }
    } else if (api.isLocal()) {
      // Transition an old-style session to a new-style one, but -- for now
      // -- only if running in a local-dev situation, so as to limit the blast
      // radius in case things aren't quite working. **TODO:** Remove the
      // `isLocal()` test and the following `else`, once it is safe to always
      // convert old sessions, and then remove this clause (and the `if`
      // cladding) once {@link #_sessionInfo} is used ubiquitously.
      proxyPromise = this._convertOldSession();
    } else {
      proxyPromise = api.authorizeTarget(this._key);
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

  /**
   * Makes sure the underlying server connection is in the process of being
   * established.
   */
  open() {
    const api = this._getApiClient();

    if (!api.isOpen()) {
      // Even though `_getApiClient()` will eventually get the client opened,
      // it makes that `open()` call asynchronously. In this case, we want to
      // guarantee that `open()` was called synchronously before this method
      // returns.
      api.open();
    }
  }

  /**
   * Converts the old-style session auth in {@link #_key} to the info which can
   * be used to establish an equivalent, saving it in {@link #_sessionInfo}, and
   * goes ahead and establishes the session in the new style.
   *
   * @returns {Proxy} Session authorization info.
   */
  async _convertOldSession() {
    const api   = this._getApiClient();
    const proxy = await api.authorizeTarget(this._key);

    this._log.event.gotOldStyleSession();

    const info = await proxy.getSessionInfo();

    this._log.event.convertedToSessionInfo(info);

    const authorProxy = api.getProxy(info.authorToken);

    return authorProxy.findExistingSession(info.documentId, info.caretId);
  }

  /**
   * API client instance to use. The client is not guaranteed to be fully open
   * at the time it is returned; however, `open()` will have been called on it,
   * which means that it will at least be in the _process_ of opening and
   * available to enqueue (if not actually transmit) messages.
   *
   * @returns {ApiClient} API client interface.
   */
  _getApiClient() {
    const url = (this._sessionInfo !== null)
      ? this._sessionInfo.serverUrl
      : this._key.url;

    if ((this._apiClient === null) || !this._apiClient.isOpen()) {
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
}
