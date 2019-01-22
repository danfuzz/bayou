// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from '@bayou/api-client';
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
   * @param {SessionInfo} info Info object that identifies the session and
   *   grants access to it. **Note:** A session is tied to a specific caret,
   *   which is associated with a single document and author. If passed an
   *   instance without a caret ID, then the act of establishing the session
   *   will cause a new caret to be created.
   */
  constructor(info) {
    super();

    /**
     * {SessionInfo} Identifying and authorizing information for the session.
     */
    this._sessionInfo = SessionInfo.check(info);

    /**
     * {Logger} Maximally-specific logger. This gets updated if/when
     * {@link #_sessionInfo} gets updated (e.g. when the session gains a caret).
     */
    this._log = log.withAddedContext(...this._sessionInfo.logTags);

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
   * Logged messages include a reference to the document ID and (if available)
   * the caret ID.
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

  /** {PropertyClient} Property accessor this session. */
  get propertyClient() {
    if (this._propertyClient === null) {
      this._propertyClient = new PropertyClient(this);
    }

    return this._propertyClient;
  }

  /**
   * {SessionInfo} Information which identifies and authorizes the session.
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
    this._log.event.askedForSessionProxy();

    const api = await this._getApiClient();

    if (this._sessionProxyPromise === null) {
      this._log.event.initialSessionSetup();
    } else {
      this._log.event.checkingSessionValidity();
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

    // Call a helper method to set up the proxy. We have to do it as a helper
    // (or as an immediate-async-call block, but that's kinda ugly for such a
    // big method), so that we can synchronously set `_sessionProxyPromise`.
    const proxyPromise = this._fetchSessionProxy(api);
    this._sessionProxyPromise = proxyPromise;

    this._log.event.gettingSessionProxy();
    const proxy = await proxyPromise;
    this._log.event.gotSessionProxy();

    return proxy;
  }

  /**
   * Makes sure the underlying server connection is in the process of being
   * established.
   */
  open() {
    this._log.event.askedToOpen();

    // This call ensures that, if the API client isn't yet constructed, or if
    // it had gotten closed, that it gets (re)constructed and (re)opened. We
    // swallow exceptions here because this method is synchronous: We don't want
    // eventual-failure of the call to turn into a top-level "unhandled promise
    // rejection" issue. If it fails, then other parts of the code will (or at
    // least _should_) ultimately recognize the failure and retry (or eventually
    // but explicitly give up).
    (async () => {
      try {
        await this._getApiClient();
      } catch (e) {
        // **Note:** No need to log the error, because `_getApiClient()` will
        // have already logged it.
      }
    })();
  }

  /**
   * Gets the API client instance to use. The client will have been successfully
   * opened before this method returns (if it returns normally instead of
   * throwing an error), but there is no guarantee that it won't have gotten
   * closed by the time the caller gets to run (because asynchrony).
   *
   * @returns {ApiClient} API client interface.
   */
  async _getApiClient() {
    if ((this._apiClient !== null) && this._apiClient.isOpen()) {
      this._log.event.apiAlreadyOpen();
      return this._apiClient;
    }

    const url = this._sessionInfo.serverUrl;

    this._log.event.apiAboutToOpen(url);
    this._apiClient = new ApiClient(url, appCommon_TheModule.fullCodec);

    try {
      this._log.event.apiOpening();
      await this._apiClient.open();
      this._log.event.apiOpened();
    } catch (e) {
      // Log the problem, and rethrow. **TODO:** Consider this as a spot to
      // add retry logic.
      this._log.event.apiOpenFailed(e);
      throw e;
    }

    return this._apiClient;
  }

  /**
   * Helper for {@link #getSessionProxy}, which performs the main act of asking
   * the server for a proxy, including fallback logic for when a requested
   * caret turns out not to exist.
   *
   * @param {ApiClient} api The API instance to use.
   * @returns {Proxy} Proxy for the session.
   */
  async _fetchSessionProxy(api) {
    const info = this._sessionInfo;

    this._log.event.usingInfo(info.logInfo);

    const authorProxy = api.getProxy(info.authorToken);

    if (info.caretId !== null) {
      const result = await authorProxy.findExistingSession(info.documentId, info.caretId);
      if (result !== null) {
        return result;
      }

      // The caret didn't exist! Probably because the session was idle too
      // long and got collected. Log it, and then fall through to create a
      // session with a new caret.
      this._log.event.missingCaret(info.caretId);
    }

    const result = await authorProxy.makeNewSession(info.documentId);

    // Update `_sessionInfo` and `_log` with the new caret info.
    const caretId = await result.getCaretId();

    this._log.event.gotCaret(caretId);

    this._sessionInfo = info.withCaretId(caretId);
    this._log         = log.withAddedContext(...this._sessionInfo.logTags);

    return result;
  }
}
