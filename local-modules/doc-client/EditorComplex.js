// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from 'api-common';
import { Hooks } from 'hooks-client';
import { BayouKeyHandlers, QuillProm } from 'quill-util';
import { Logger } from 'see-all';
import { TObject } from 'typecheck';
import { DomUtil } from 'util-client';
import { CommonBase, PromCondition } from 'util-common';

import CaretOverlay from './CaretOverlay';
import DocClient from './DocClient';
import DocSession from './DocSession';

/** {Logger} Logger for this module. */
const log = new Logger('editor-complex');

/** {object} Default Quill module configuration for the document body. */
const DEFAULT_BODY_MODULE_CONFIG = {
  keyboard: BayouKeyHandlers.defaultKeyHandlers,
  toolbar: [
    ['bold', 'italic', 'underline', 'strike', 'code'], // Toggled buttons.
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
    [{ header: [1, 2, 3, false] }],
    [{ align: [] }],
    ['clean'] // "Remove formatting" button.
  ]
};

/** {object} Default Quill module configuration for the title field. */
const DEFAULT_TITLE_MODULE_CONFIG = {
  keyboard: BayouKeyHandlers.singleLineKeyHandlers,
  toolbar: [
    ['italic', 'underline', 'strike', 'code'], // Toggled buttons.
    [{ align: [] }],
    ['clean'] // "Remove formatting" button.
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
     * {PromCondition} Condition that becomes true when the instance is
     * ready to be used.
     */
    this._ready = new PromCondition();

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
     * {DocClient|null} Document client instance (API-to-editor hookup). Set in
     * `_initSession()`.
     */
    this._docClient = null;

    // The rest of the initialization has to happen asynchronously. In
    // particular, there is no avoiding the asynchrony in `_domSetup()`, and
    // that setup needs to be complete before we construct the Quill and
    // author overlay instances. And _all_ of this needs to be done before we
    // make a `DocClient` (which gets done by `_initSession()`).
    (async () => {
      // Do all of the DOM setup for the instance.
      const [titleNode, quillNode, authorOverlayNode] =
        await this._domSetup(topNode, sessionKey.baseUrl);

      /** {QuillProm} The Quill editor object for the document title. */
      this._titleQuill = new QuillProm(titleNode, {
        readOnly: false,
        strict:   true,
        theme:    'bubble',
        modules:  EditorComplex._titleModuleConfig
      });

      /** {QuillProm} The Quill editor object. */
      this._bodyQuill = new QuillProm(quillNode, {
        readOnly: true,
        strict:   true,
        theme:    'bubble',
        modules:  EditorComplex._bodyModuleConfig
      });

      // Let the overlay do extra initialization.
      Hooks.theOne.quillInstanceInit(this._titleQuill);
      Hooks.theOne.quillInstanceInit(this._bodyQuill);

      /** {CaretOverlay} The remote caret overlay controller. */
      this._caretOverlay = new CaretOverlay(this, authorOverlayNode);

      // Do session setup using the initial key.
      this._initSession(sessionKey, true);

      this._ready.value = true;
    })();
  }

  /** {CaretOverlay} The author overlay controller. */
  get authorOverlay() {
    return this._caretOverlay;
  }

  /** {DocClient} The document client instance. */
  get docClient() {
    return this._docClient;
  }

  /** {DocSession} The session control instance. */
  get docSession() {
    return this._docSession;
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
    log.info(`Hooking up new session: ${sessionKey}`);
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
    this._docClient  = new DocClient(this._bodyQuill, this._docSession);

    this._docClient.start();

    // Log a note once everything is all set up.
    (async () => {
      await this._docClient.when_idle();
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
      throw new Error('Expected `topNode` to be a `div`.');
    }

    topNode.classList.add('bayou-top');

    const document = topNode.ownerDocument;

    // Similarly, give the page itself the right CSS style.
    const htmlNode = document.getElementsByTagName('html')[0];
    if (!htmlNode) {
      throw new Error('Shouldn\'t happen: No `html` node?!');
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

    // The "top" node that gets passed in actually ends up being a container
    // for both the editor per se as well as other bits. The node we make here
    // is the one that actually ends up getting controlled by Quill. The loop
    // re-parents all the default content under the original editor to instead
    // be under the Quill node.
    const quillNode = document.createElement('div');
    quillNode.classList.add('bayou-editor');
    for (;;) {
      const node = topNode.firstChild;
      if (!node) {
        break;
      }
      topNode.removeChild(node);
      quillNode.appendChild(node);
    }
    topNode.appendChild(quillNode);

    // Make the author overlay node. **Note:** The wacky namespace URL is
    // required. Without it, the "SVG" element is actually left uninterpreted.
    const authorOverlayNode =
      document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    authorOverlayNode.classList.add('bayou-author-overlay');
    topNode.appendChild(authorOverlayNode);

    const titleNode = document.createElement('div');
    titleNode.classList.add('bayou-title-editor');

    topNode.insertBefore(titleNode, quillNode);

    return [titleNode, quillNode, authorOverlayNode];
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

  /**
   * The Quill module configuration to use. This uses a hook to get the value
   * the first time it's needed, caching the result for later reuse.
   */
  static get _bodyModuleConfig() {
    if (!EditorComplex._bodyModuleConfigValue) {
      const moduleConfig =
        Hooks.theOne.quillModuleConfig('body', DEFAULT_BODY_MODULE_CONFIG);
      EditorComplex._bodyModuleConfigValue = Object.freeze(moduleConfig);
    }

    return EditorComplex._bodyModuleConfigValue;
  }
}
