// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from '@bayou/api-common';
import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { Editor } from '@bayou/config-client';
import { SessionInfo } from '@bayou/doc-common';
import { EditorComplex } from '@bayou/doc-ui';
import { Logger } from '@bayou/see-all';
import { TFunction, TObject } from '@bayou/typecheck';

/** {Logger} Logger for this module. */
const log = new Logger('top');

/**
 * Top-level control for an editor. This is responsible for setting up the
 * browser environment and for keeping things going.
 */
export default class TopControl {
  /**
   * Constructs an instance.
   *
   * @param {Window} window The browser window in which we are operating.
   */
  constructor(window) {
    /** {Window} The browser window in which we are operating. */
    this._window = window;

    // Pull the incoming parameters from `window.*` globals into instance
    // variables. Validate that they're present before doing anything further.

    /**
     * {SplitKey|SessionInfo} The info that identifies and authorizes access to
     * a session. Set initially based on the incoming parameter `BAYOU_INFO`
     * (transmitted via a `window` global), which is expected to be the
     * JSON-encoded form of `SplitKey` or `SessionInfo`. The so-referenced
     * session is tied to a specific document and a specific author, allowing
     * general read access to the document and allowing modification to the
     * document as the one specific author.
     */
    this._sessionInfo = this._parseAndFixInfo(window.BAYOU_INFO);

    /** {Element} DOM node to use for the editor. */
    this._editorNode = TObject.check(window.BAYOU_NODE, Element);

    /**
     * {function} Function to call when the editor finds itself in an
     * unrecoverable (to it) situation. It gets called with the current key as
     * its sole argument. If it returns at all, it is expected to return a new
     * key to use (instead of `BAYOU_INFO`), or a promise for same; if it does
     * not return a string (or promise which resolves to a string) that can be
     * decoded into a `SplitKey`, the system will simply halt.
     *
     * If not supplied, this variable defaults to a no-op function.
     */
    this._recover =
      TFunction.checkCallable(window.BAYOU_RECOVER || (() => { /* empty */ }));

    /**
     * {EditorComplex|null} Editor "complex" instance, for all of the
     * DOM-related state and control. Becomes non-null in `start()`.
     */
    this._editorComplex = null;

    // Store this instance as a window global, mostly for ease of debugging.
    // **TODO:** Consider removing this.
    window.BAYOU_CONTROL = this;
  }

  /**
   * Starts things up.
   */
  async start() {
    // Let the outer app do its setup.

    // **TODO:** Simplify this once `SessionInfo` is used ubiquitously.
    const serverUrl = (this._sessionInfo instanceof SessionInfo)
      ? this._sessionInfo.serverUrl
      : this._sessionInfo.baseUrl;
    await Editor.aboutToRun(this._window, serverUrl);

    // Arrange for the rest of initialization to happen once the initial page
    // contents are ready (from the browser's perspective).
    const document = this._window.document;
    if (document.readyState === 'complete') {
      log.detail('Page already ready. No waiting needed!');
      this._onReady();
    } else {
      log.detail('Waiting for page to be ready.');
      const listener = (event_unused) => {
        if (document.readyState === 'complete') {
          log.detail('Page now ready.');
          this._onReady();
          document.removeEventListener('readystatechange', listener);
        }
      };
      document.addEventListener('readystatechange', listener);
    }
  }

  /**
   * Callback for page content readiness. This is set up in `start()`.
   */
  async _onReady() {
    // Make the editor "complex." This "fluffs" out the DOM and makes the
    // salient controller objects.
    this._editorComplex =
      new EditorComplex(this._sessionInfo, this._window, this._editorNode);

    await this._editorComplex.whenReady();
    this._recoverySetup();
  }

  /**
   * Hooks things up so that this instance gets notified if/when the editor
   * aborts due to error. Should that happen, a recovery attempt is initiated.
   */
  _recoverySetup() {
    (async () => {
      await this._editorComplex.bodyClient.when_unrecoverableError();
      this._recoverIfPossible();
    })();
  }

  /**
   * This gets called when the editor gives up from getting too many errors. If
   * the `_recover` function returns something useful, this attempts to restart
   * the client.
   */
  async _recoverIfPossible() {
    log.error('Editor gave up!');

    const newInfo = await this._recover(this._editorComplex.docSession.keyOrInfo);

    if (typeof newInfo !== 'string') {
      log.info('Nothing more to do. :\'(');
      return;
    }

    log.info('Attempting recovery with new session info...');
    const sessionInfo = this._parseAndFixInfo(newInfo);
    this._editorComplex.connectNewSession(sessionInfo);
    this._recoverySetup();
  }

  /**
   * Parses session identification / authorization info, and fixes it if
   * necessary to have a real (not wildcard) URL.
   *
   * @param {string} infoJson The info, in JSON-encoded form.
   * @returns {SplitKey|SessionInfo} The parsed and fixed info.
   */
  _parseAndFixInfo(infoJson) {
    const info = appCommon_TheModule.fullCodec.decodeJson(infoJson);

    if (info instanceof SessionInfo) {
      // No fixing needed, because the URL is guaranteed to be valid.
      return info;
    }

    SplitKey.check(info);

    if (info.url === '*') {
      const url = new URL(this._window.document.URL);
      return info.withUrl(`${url.origin}/api`);
    }

    return info;
  }
}
