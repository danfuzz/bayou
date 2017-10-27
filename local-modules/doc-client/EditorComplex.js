// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { SplitKey } from 'api-common';
import { ClientStore } from 'data-model-client';
import { Hooks } from 'hooks-client';
import { Condition } from 'promise-util';
import { BayouKeyHandlers, QuillProm } from 'quill-util';
import { Logger } from 'see-all';
import { TObject } from 'typecheck';
import { Header } from 'ui-header';
import { DomUtil } from 'util-client';
import { CommonBase, Errors } from 'util-common';

import BodyClient from './BodyClient';
import CaretOverlay from './CaretOverlay';
import CaretState from './CaretState';
import DocSession from './DocSession';

/** {Logger} Logger for this module. */
const log = new Logger('editor-complex');

/** {object} Default Quill module configuration for the document body. */
const DEFAULT_BODY_MODULE_CONFIG = {
  keyboard: BayouKeyHandlers.defaultKeyHandlers,
  toolbar: [
    [{ header: 1 }, { header: 2 }, { header: 3 }],
    ['bold', 'italic', 'underline', 'strike', 'code'], // Toggled buttons.
  ]
};

/** {object} Default Quill module configuration for the title field. */
const DEFAULT_TITLE_MODULE_CONFIG = {
  keyboard: BayouKeyHandlers.defaultSingleLineKeyHandlers,
  toolbar: [
    ['italic', 'underline', 'strike', 'code'], // Toggled buttons.
  ]
};

/**
 * Manager for the "complex" of objects and DOM nodes which in aggregate form
 * the client-side editor.
 */
export default class EditorComplex extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {SplitKey} sessionKey Access credentials to the session to use for
   *   server communication.
   * @param {Window} window The browser window in which we are operating.
   * @param {Element} topNode DOM element to attach the complex to.
   */
  constructor(sessionKey, window, topNode) {
    SplitKey.check(sessionKey);
    TObject.check(window, Window);
    TObject.check(topNode, Element);

    super();

    /** {Window} The browser window in which we are operating. */
    this._window = window;

    /**
     * {Condition} Condition that becomes true when the instance is
     * ready to be used.
     */
    this._ready = new Condition();

    /**
     * {SplitKey|null} Access credentials to the session to use for server
     * communication. Set in `_initSession()`.
     */
    this._sessionKey = null;

    /**
     * {DocSession|null} Session control/management instance. Set in
     * `_initSession()`.
     */
    this._docSession = null;

    /**
     * {BodyClient|null} Document body client instance (API-to-editor hookup).
     * Set in `_initSession()`.
     */
    this._bodyClient = null;

    /**
     * {ClientStore} Wrapper for the redux data store for this client.
     */
    this._clientStore = new ClientStore();

    // The rest of the initialization has to happen asynchronously. In
    // particular, there is no avoiding the asynchrony in `_domSetup()`, and
    // that setup needs to be complete before we construct the Quill and
    // author overlay instances. And _all_ of this needs to be done before we
    // make a `BodyClient` (which gets done by `_initSession()`).
    (async () => {
      // Do all of the DOM setup for the instance.
      const [headerNode, titleNode, quillNode, authorOverlayNode] =
        await this._domSetup(topNode, sessionKey.baseUrl);

      // The Provider component wraps our React application and makes the
      // Redux store available in the context of all of the wrapped
      // components. This is needed for the calls to `react-redux.connect()`
      // that are used within each of the header components.
      ReactDOM.render(
        <Provider store={ this._clientStore.store }>
          <Header />
        </Provider>,
        headerNode
      );

      /** {QuillProm} The Quill editor object for the document title. */
      this._titleQuill = new QuillProm(titleNode, {
        readOnly: false,
        strict:   true,
        theme:    Hooks.theOne.quillThemeName('title'),
        modules:  EditorComplex._titleModuleConfig
      });

      /** {QuillProm} The Quill editor object. */
      this._bodyQuill = new QuillProm(quillNode, {
        readOnly: true,
        strict:   true,
        theme:    Hooks.theOne.quillThemeName('body'),
        modules:  EditorComplex._bodyModuleConfig
      });

      /**
       * {CaretState} Machinery that watches for changes to the
       * session state and updates the client redux store.
       */
      this._caretState = new CaretState(this);

      /** {CaretOverlay} The remote caret overlay controller. */
      this._caretOverlay = new CaretOverlay(this, authorOverlayNode);

      // Let the overlay do extra initialization.
      Hooks.theOne.editorComplexInit(this);

      // Do session setup using the initial key.
      this._initSession(sessionKey, true);

      this._ready.value = true;
    })();
  }

  /** {CaretOverlay} The author overlay controller. */
  get authorOverlay() {
    return this._caretOverlay;
  }

  /** {BodyClient} The document body client instance. */
  get bodyClient() {
    return this._bodyClient;
  }

  /** {DocSession} The session control instance. */
  get docSession() {
    return this._docSession;
  }

  /** {ClientStore} Pub/sub interface for client data model changes. */
  get clientStore() {
    return this._clientStore;
  }

  /** {Logger} Logger to use when _not_ referring to the session. */
  get log() {
    return log;
  }

  /** {QuillProm} The Quill editor object for the title field. */
  get titleQuill() {
    return this._titleQuill;
  }

  /** {QuillProm} The Quill editor object for the body text. */
  get bodyQuill() {
    return this._bodyQuill;
  }

  /**
   * {string|null} The session ID of the current server session, or `null` if
   * no session is currently active.
   */
  get sessionId() {
    const docSession = this.docSession;
    return (docSession === null) ? null : docSession.key.id;
  }

  /**
   * Hook this instance up to a new session.
   *
   * @param {SplitKey} sessionKey New session key to use.
   */
  connectNewSession(sessionKey) {
    log.info('Hooking up new session:', sessionKey.toString());
    this._initSession(sessionKey, false);
  }

  /**
   * Returns `true` once the instance is ready for use.
   *
   * @returns {boolean} `true` once the instance is ready for use.
   */
  async whenReady() {
    return this._ready.whenTrue();
  }

  /**
   * Initialize the session, based on the given key.
   *
   * @param {SplitKey} sessionKey The session key.
   * @param {boolean} fromConstructor `true` iff this call is from the
   *   constructor.
   */
  _initSession(sessionKey, fromConstructor) {
    this._sessionKey = SplitKey.check(sessionKey);
    this._docSession = new DocSession(this._sessionKey);
    this._bodyClient  = new BodyClient(this._bodyQuill, this._docSession);

    this._bodyClient.start();

    // Log a note once everything is all set up.
    (async () => {
      await this._bodyClient.when_idle();
      if (fromConstructor) {
        log.info('Initialization complete!');
      } else {
        log.info('Done with reinitialization.');
      }
    })();
  }

  /**
   * Does all of the DOM setup needed to make the indicated "top" node be
   * ready to have Quill and the author overlay attached to it.
   *
   * @param {Element} topNode The top DOM node for the complex.
   * @param {string} baseUrl Base URL of the server.
   * @returns {array<Element>} Array of `[quillNode, authorOverlayNode]`, for
   *   immediate consumption by the constructor.
   */
  async _domSetup(topNode, baseUrl) {
    // Validate the top node, and give it the right CSS style.
    if (topNode.nodeName !== 'DIV') {
      throw Errors.bad_use('Expected `topNode` to be a `div`.');
    }

    topNode.classList.add('bayou-top');

    const document = topNode.ownerDocument;

    // Similarly, give the page itself the right CSS style.
    const htmlNode = document.getElementsByTagName('html')[0];
    if (!htmlNode) {
      throw Errors.wtf('No `html` node?!');
    }
    htmlNode.classList.add('bayou-page');

    const styleDone =
      DomUtil.addStylesheet(document, `${baseUrl}/static/index.css`);

    // Give the overlay a chance to do any initialization.
    const hookDone = Hooks.theOne.run(this._window, baseUrl);

    // Let all that activity finish before proceeding.
    log.detail('Async operations now in progress...');
    await styleDone;
    await hookDone;
    log.detail('Done with async operations.');

    // Remove the static content from the original "top" node (which is a
    // "loading..." message).
    while (topNode.firstChild) {
      topNode.removeChild(topNode.firstChild);
    }

    // Make the node for the document header. The includes the title, the
    // widgets for sharing, list of viewers/editors, etc.
    const headerNode = document.createElement('div');
    topNode.appendChild(headerNode);

    // Make the node for the document title. **TODO:** This may want to expand
    // to be a more general document header section.

    const titleNode = document.createElement('div');
    titleNode.classList.add('bayou-title-editor');

    // Default title contents. **TODO:** This should be coming from the server.
    // Remove this once that is hooked up.
    titleNode.appendChild(document.createTextNode('Untitled'));

    topNode.appendChild(titleNode);

    // Make the node for the document body section. The most prominent part of
    // this section is the `<div>` managed by Quill. In addition, this is where
    // the author overlay goes.

    const bodyNode = document.createElement('div');
    bodyNode.classList.add('bayou-body');
    topNode.appendChild(bodyNode);

    // Make the `<div>` that actually ends up getting controlled by Quill.
    const quillNode = document.createElement('div');
    quillNode.classList.add('bayou-editor');
    bodyNode.appendChild(quillNode);

    // Make the author overlay node. **Note:** The wacky namespace URL is
    // required. Without it, the `<svg>` element is actually left uninterpreted.
    const authorOverlayNode =
      document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    authorOverlayNode.classList.add('bayou-author-overlay');
    bodyNode.appendChild(authorOverlayNode);

    return [headerNode, titleNode, quillNode, authorOverlayNode];
  }

  /**
   * The Quill module configuration to use for the main body editor. This uses a
   * hook to get the value the first time it's needed, caching the result for
   * later reuse.
   */
  static get _bodyModuleConfig() {
    if (!EditorComplex._bodyModuleConfigValue) {
      const moduleConfig =
        Hooks.theOne.quillModuleConfig('body', DEFAULT_BODY_MODULE_CONFIG);
      EditorComplex._bodyModuleConfigValue = Object.freeze(moduleConfig);
    }

    return EditorComplex._bodyModuleConfigValue;
  }

  /**
   * The Quill module configuration to use for the title field.
   * This uses a hook to get the value the first time it's needed,
   * caching the result for later reuse.
   */
  static get _titleModuleConfig() {
    if (!EditorComplex._titleModuleConfigValue) {
      const moduleConfig =
        Hooks.theOne.quillModuleConfig('title', DEFAULT_TITLE_MODULE_CONFIG);
      EditorComplex._titleModuleConfigValue = Object.freeze(moduleConfig);
    }

    return EditorComplex._titleModuleConfigValue;
  }
}
