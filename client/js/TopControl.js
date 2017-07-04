// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from 'api-client';
import { Codec, SplitKey } from 'api-common';
import { DocClient } from 'doc-client';
import { Hooks } from 'hooks-client';
import { QuillMaker } from 'quill-util';
import { Logger } from 'see-all';
import { TFunction, TString } from 'typecheck';
import { DomUtil } from 'util-client';

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
     * {SplitKey} Key that authorizes access and update to a particular document
     * as a specific author. The `BAYOU_KEY` incoming parameter is expected to
     * be a `SplitKey` in JSON-encoded form.
     */
    this._key = SplitKey.check(Codec.theOne.decodeJson(window.BAYOU_KEY));

    /**
     * {string} DOM Selector string that indicates which node in the DOM should
     * become the editor.
     */
    this._node = TString.nonempty(window.BAYOU_NODE);

    /**
     * {function} Function to call when the editor finds itself in an
     * unrecoverable (to it) situation. It gets called with the current key as
     * its sole argument. If it returns at all, it is expected to return a new
     * key to use (instead of `BAYOU_KEY`), or a promise for same; if it does
     * not return a string (or promise which resolves to a string) that can be
     * decoded into a `SplitKey`, the system will simply halt.
     *
     * If not supplied, this variable defaults to a no-op function.
     */
    this._recover =
      TFunction.check(window.BAYOU_RECOVER || (() => { /* empty */ }));

    /** {QuillProm|null} Editor instance. Becomes non-null in `start()`. */
    this._quill = null;

    /**
     * {ApiClient|null} API client instance (client-to-server hookup). Becomes
     * non-null in `_makeApiClient()`.
     */
    this._apiClient = null;

    /**
     * {DocClient|null} Client instance (API-to-editor hookup). Becomes non-null
     * in `_makeDocClient()`.
     */
    this._docClient = null;

    // Store this instance as a window global, mostly for ease of debugging.
    // TODO: Consider removing this.
    window.BAYOU_CONTROL = this;
  }

  /**
   * Starts things up.
   */
  start() {
    // Initialize the API connection. We do this in parallel with the rest of
    // the page loading, so as to minimize time-to-interactive.
    this._makeApiClient();

    // Arrange for the rest of initialization to happen once the initial page
    // contents are fully loaded.
    this._window.addEventListener('load', (event_unused) => {
      log.detail('Initial page load complete.');
      this._onLoad();
    });
  }

  /**
   * Callback for page load. This is set up in `start()`.
   */
  async _onLoad() {
    const document = this._window.document;
    const baseUrl = this._apiClient.baseUrl;
    const editorNode = document.querySelector(this._node);

    if (editorNode === null) {
      // The indicated node (incoming `BAYOU_NODE` value) does not exist. If
      // we land here, no further init can possibly be done, so we just
      // `throw` out of it.
      const extra = (this._node[0] === '#') ? '' : ' (maybe need a `#` prefix?)';
      throw new Error(`No such selector${extra}: \`${this._node}\``);
    } else if (editorNode.nodeName !== 'DIV') {
      // Similar to above.
      throw new Error(`Expected selector \`${this._node}\` to refer to a \`div\`.`);
    }

    // Do our basic page setup. Specifically, we add the CSS we need to the
    // page and set the expected classes on the `html` and editor nodes.

    const styleDone =
      DomUtil.addStylesheet(document, `${baseUrl}/static/index.css`);

    const htmlNode = document.getElementsByTagName('html')[0];
    if (!htmlNode) {
      throw new Error('Shouldn\'t happen: No `html` node?!');
    }
    htmlNode.classList.add('bayou-page');

    // Expect the editor node to have two children, namely the author overlay
    // and the inner editor containor.
    const editorChildren = editorNode.children;
    const authorOverlayNode = editorChildren[0];
    const quillNode = editorChildren[1];
    authorOverlayNode.classList.add('bayou-author-overlay');
    quillNode.classList.add('bayou-editor');

    // Give the overlay a chance to do any initialization.
    const hookDone = Hooks.theOne.run(this._window, baseUrl);

    log.detail('Async operations now in progress...');

    // Make the editor instance, after style addition and hook action are
    // complete.

    await styleDone;
    await hookDone;

    this._quill = QuillMaker.theOne.make(quillNode);
    log.detail('Made editor instance.');

    // Hook up the `DocClient` (which intermediates between the server and
    // the local Quill instance).
    this._makeDocClient();
  }

  /**
   * Fixes the instance's `_key`, if necessary, so that it has a real URL (and
   * not just a catchall). Replaces the instance variable if any fixing was
   * required.
   *
   * **Note:** Under normal circumstances, the key we receive comes with a
   * real URL. However, when using the debugging routes, it's possible that we
   * end up with the catchall "URL" `*`. If so, that's when we fall back to
   * using the document's URL. client.
   */
  _fixKeyIfNecessary() {
    const key = this._key;

    if (key.url === '*') {
      const url = new URL(this._window.document.URL);
      this._key = key.withUrl(`${url.origin}/api`);
    }
  }

  /**
   * Constructs and connects an `ApiClient` instance.
   */
  _makeApiClient() {
    log.detail('Opening API client...');

    // Fix the key first if necessary (to have a proper URL).
    this._fixKeyIfNecessary();

    this._apiClient = new ApiClient(this._key.url);

    (async () => {
      await this._apiClient.open();
      log.detail('API client open.');
    })();
  }

  /**
   * Constructs and hooks up a `DocClient` instance.
   */
  _makeDocClient() {
    this._docClient = new DocClient(this._quill, this._apiClient, this._key);
    this._docClient.start();

    // Log a note once everything is all set up.
    (async () => {
      await this._docClient.when_idle();
      log.info('Initialization complete!');
    })();

    // Handle doc client failure if and when it ever happens.
    (async () => {
      await this._docClient.when_unrecoverableError();
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

    const newKey = await this._recover(this._key);

    if (typeof newKey !== 'string') {
      log.info('Nothing more to do. :\'(');
      return;
    }

    log.info('Attempting recovery with new key...');
    this._key = SplitKey.check(Codec.theOne.decodeJson(newKey));
    this._makeApiClient();
    this._makeDocClient();
  }
}
