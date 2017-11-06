// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from 'api-client';
import { BaseKey } from 'api-common';
import { Logger } from 'see-all';
import { CommonBase } from 'util-common';

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
   *   it. **Note:** A session is specifically tied to a single author and a
   *   single document.
   */
  constructor(key) {
    super();

    /**
     * {BaseKey} Key that identifies the server-side session and grants access
     * to it.
     */
    this._key = BaseKey.check(key);

    /** {Logger} Logger specific to this document's ID. */
    this._log = log.withPrefix(`[${key.id}]`);

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
      this._apiClient = new ApiClient(this._key.url);

      (async () => {
        await this._apiClient.open();
        log.detail('API client open.');
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
      (async () => {
        // This will log a note once the promise resolves.
        await this._sessionProxyPromise;
        this._log.info('Received session proxy.');
      })();
    }

    // **Note:** Because this is an `async` method, it's okay to return a
    // promise.
    return this._sessionProxyPromise;
  }
}
