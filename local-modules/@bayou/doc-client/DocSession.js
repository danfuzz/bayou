// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from '@bayou/api-client';
import { Codecs } from '@bayou/app-common';
import { CaretId, SessionInfo } from '@bayou/doc-common';
import { EventSource } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

import { CaretTracker } from './CaretTracker';
import { PropertyClient } from './PropertyClient';

/** Logger. */
const log = new Logger('doc');

/**
 * Manager of the API connection(s) needed to maintain a server session.
 *
 * Instances of this class emit events which indicate the instantaneous state of
 * of their network connections along with any higher-level errors (which get
 * reported to the instance). Events are as follows:
 *
 * * `closed()` &mdash; The network connection has been closed.
 * * `error(?e)` &mdash; There was an error either in establishing a connection
 *   or at a higher layer (e.g. an unexpected failure in an API call). If there
 *   is a salient error which is associated with the problem, it is passed as an
 *   argument to the event.
 * * `opening()` &mdash; The instance is trying to establish a network
 *   connection with a server.
 * * `open()` &mdash; The network connection has been established.
 */
export class DocSession extends CommonBase {
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
    SessionInfo.check(info);

    super();

    /**
     * {SessionInfo|null} Identifying and authorizing information for the
     * session. Set in {@link #_updateSessionInfo}.
     */
    this._sessionInfo = null;

    /**
     * {Logger|null} Maximally-specific logger. This gets set and updated in
     * parallel with {@link #_sessionInfo}, in {@link #_updateSessionInfo}.
     */
    this._log = null;

    /**
     * {EventSource} Emitter of events, by and large related to this instance's
     * understanding of the current network status.
     */
    this._eventSource = new EventSource();

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

    this._updateSessionInfo(info);

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

  /**
   * {Promise<ChainedEvent>} Promise for the current (latest / most recent)
   * event emitted by this instance. This is an immediately-resolved promise in
   * all cases _except_ when this instance has never emitted an event. In the
   * latter case, it becomes resolved as soon as the first event is emitted.
   *
   * **Note:** Because of the chained nature of events, this property provides
   * access to all subsequent events emitted by this source.
   */
  get currentEvent() {
    return this._eventSource.currentEvent;
  }

  /**
   * {EventEmitter} Event emitter which can be attached to in order to receive
   * events from this instance.
   */
  get eventEmitter() {
    return this._eventSource.emitter;
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
   * Indicates whether the given caret ID identifies the caret controlled by
   * this instance.
   *
   * **Note:** It is possible for this to return a false negative when the
   * session is in the process of being established (because we don't yet know
   * which caret the instance will ultimately control).
   *
   * @param {string} caretId The caret ID in question.
   * @returns {boolean} `true` if `caretId` is the ID of the caret that this
   *   instance controls, or `false` if not.
   */
  controlsCaret(caretId) {
    CaretId.check(caretId);

    return (caretId === this._sessionInfo.caretId);
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

      try {
        const proxy = await this._sessionProxyPromise;
        if (api.handles(proxy)) {
          // The session proxy we already had is still apparently valid, so it's
          // safe to return it.
          this._log.event.sessionStillValid();
          return proxy;
        }
      } catch (e) {
        // A previous attempt to set up the session failed in the call to
        // `_fetchSessionProxy()` below.
        this._log.event.previousSessionSetupFailed(e);
      }

      // Either the proxy never got set up or it used to be valid but on a
      // different API session/connection. Fall through to re-set-up the
      // session.
      this._log.event.mustReestablishSession();
    }

    // Call a helper method to set up the proxy. We have to do it as a helper
    // (or as an immediate-async-call block, but that's kinda ugly for such a
    // big method), so that we can synchronously set `_sessionProxyPromise`.
    const proxyPromise = this._fetchSessionProxy(api);
    this._sessionProxyPromise = proxyPromise;

    try {
      this._log.event.gettingSessionProxy();
      const proxy = await proxyPromise;
      this._log.event.gotSessionProxy();

      return proxy;
    } catch (e) {
      // Emit an event for and log the problem, and rethrow.
      this._eventSource.emit.closed();
      this._log.event.sessionSetupFailed(e);
      throw e;
    }
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
   * Reports trouble. This call can be used by associated objects to indicate to
   * this one that there is a higher-level error of some sort. This instance in
   * turn emits that fact as an event, which downstream client code can use to
   * inform its own behavior.
   *
   * @param {Error|null} [error = null] Salient `Error` instance, if any.
   */
  reportError(error) {
    const eventArgs = (error === null) ? [] : [error];

    this._eventSource.emit.error(...eventArgs);
    this._log.event.errorReported(...eventArgs);
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

    const url = this._sessionInfo.apiUrl;

    this._eventSource.emit.opening();
    this._log.event.apiAboutToOpen(url);

    try {
      this._apiClient = new ApiClient(url, Codecs.fullCodec);
    } catch (e) {
      // Log and rethrow, to help unambiguously identify when this constructor
      // is having trouble. (Why needed? Because in some contexts we don't have
      // a high-fidelity stack trace, but we _do_ have logs.)
      this._log.event.troubleConstructingApiClient(e);
      throw e;
    }

    try {
      this._log.event.apiOpening();
      await this._apiClient.open();
      this._eventSource.emit.open();
      this._log.event.apiOpened();
    } catch (e) {
      // Emit an event for and log the problem, and rethrow. **TODO:** Consider
      // this as a spot to add retry logic.
      this._eventSource.emit.closed();
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
    this._updateSessionInfo(info.withCaretId(caretId));

    return result;
  }

  /**
   * Update the {@link #_sessionInfo}, and perform a corresponding update on
   * {@link #_log}.
   *
   * @param {SessionInfo} sessionInfo The new info.
   */
  _updateSessionInfo(sessionInfo) {
    SessionInfo.check(sessionInfo);

    this._sessionInfo = sessionInfo;
    this._log         = log.withAddedContext(...sessionInfo.logTags);
  }
}
