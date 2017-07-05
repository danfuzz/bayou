// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from 'api-client';
import { Codec, SplitKey } from 'api-common';
import { DocClient } from 'doc-client';
import { Hooks } from 'hooks-client';
import { EditorComplex } from 'quill-util';
import { Logger } from 'see-all';
import { TFunction, TObject } from 'typecheck';
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

    /** {Element} DOM node to use for the editor. */
    this._editorNode = TObject.check(window.BAYOU_NODE, Element);

    // Validate it.
    if (this._editorNode.nodeName !== 'DIV') {
      throw new Error('Expected `BAYOU_NODE` to refer to a `div`.');
    }

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

    /**
     * {EditorComplex|null} Editor "complex" instance, for all of the
     * DOM-related state and control. Becomes non-null in `start()`.
     */
    this._editorComplex = null;

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
    const document   = this._window.document;
    const baseUrl    = this._apiClient.baseUrl;
    const editorNode = this._editorNode;

    // Do our basic page setup. Specifically, we add the CSS we need to the
    // page, set the expected classes on the `html` and editor nodes, and build
    // the required node structure within the editor node.

    const styleDone =
      DomUtil.addStylesheet(document, `${baseUrl}/static/index.css`);

    const htmlNode = document.getElementsByTagName('html')[0];
    if (!htmlNode) {
      throw new Error('Shouldn\'t happen: No `html` node?!');
    }
    htmlNode.classList.add('bayou-page');

    editorNode.classList.add('bayou-top');

    // The "editor" node that gets passed in actually ends up being a container
    // for both the editor per se as well as other bits. The node we make here
    // is the one that actually ends up getting controlled by Quill. The loop
    // re-parents all the default content under the original editor to instead
    // be under the Quill node.
    const quillNode = document.createElement('div');
    quillNode.classList.add('bayou-editor');
    for (;;) {
      const node = editorNode.firstChild;
      if (!node) {
        break;
      }
      editorNode.removeChild(node);
      quillNode.appendChild(node);
    }
    editorNode.appendChild(quillNode);

    // Make the author overlay node. **Note:** The wacky namespace URL is
    // required. Without it, the "SVG" element is actually left uninterpreted.
    const authorOverlayNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    authorOverlayNode.classList.add('bayou-author-overlay');
    editorNode.appendChild(authorOverlayNode);

    // Give the overlay a chance to do any initialization.
    const hookDone = Hooks.theOne.run(this._window, baseUrl);

    log.detail('Async operations now in progress...');

    // Make the editor instance, after style addition and hook action are
    // complete.

    await styleDone;
    await hookDone;

    this._editorComplex = new EditorComplex(quillNode);
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
    const quill = this._editorComplex.quill;

    this._docClient = new DocClient(quill, this._apiClient, this._key);
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
