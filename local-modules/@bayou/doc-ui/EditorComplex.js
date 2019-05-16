// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Urls } from '@bayou/app-common';
import { Editor } from '@bayou/config-client';
import { BodyClient, DocSession } from '@bayou/doc-client';
import { SessionInfo } from '@bayou/doc-common';
import { Condition } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TObject } from '@bayou/typecheck';
import { DomUtil } from '@bayou/util-client';
import { CommonBase, Errors } from '@bayou/util-common';

import { BayouKeyHandlers } from './BayouKeyHandlers';
import { CaretOverlay } from './CaretOverlay';
import { CaretState } from './CaretState';
import { TitleClient } from './TitleClient';

/** {Logger} Logger for this module. */
const log = new Logger('editor-complex');

/**
 * Manager for the "complex" of objects and DOM nodes which in aggregate form
 * the client-side editor.
 */
export class EditorComplex extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {SessionInfo} info Info object that identifies the session and
   *   grants access to it.
   * @param {Window} window The browser window in which we are operating.
   * @param {Element} topNode DOM element to attach the complex to.
   */
  constructor(info, window, topNode) {
    SessionInfo.check(info);
    TObject.check(window, Window);
    TObject.check(topNode, Element);

    super();

    EditorComplex._init();

    /** {Window} The browser window in which we are operating. */
    this._window = window;

    /**
     * {Condition} Condition that becomes true when the instance is
     * ready to be used.
     */
    this._ready = new Condition();

    /**
     * {SessionInfo|null} Key or info object that identifies the session and
     * grants access to it. Set in {@link #_initSession}.
     */
    this._sessionInfo = null;

    /**
     * {DocSession|null} Session control/management instance. Set in
     * {@link #_initSession}.
     */
    this._docSession = null;

    /**
     * {BodyClient|null} Document body client instance (API-to-editor hookup).
     * Set in {@link #_initSession}.
     */
    this._bodyClient = null;

    /**
     * {TitleClient|null} Document title client instance (API-to-editor hookup).
     * Set in {@link #_initSession}.
     */
    this._titleClient = null;

    /** {CaretState} Watcher of the caret-session state. */
    this._caretState = new CaretState(this);

    // The rest of the initialization has to happen asynchronously. In
    // particular, there is no avoiding the asynchrony in {@link #_domSetup},
    // and that setup needs to be complete before we construct the Quill and
    // author overlay instances. And _all_ of this needs to be done before we
    // make a `BodyClient` (which gets done by {@link #_initSession}).
    (async () => {
      log.event.starting();

      const serverUrl = info.serverUrl;

      // Do all of the DOM setup for the instance.
      const [headerNode_unused, titleNode, bodyNode, authorOverlayNode] =
        await this._domSetup(topNode, serverUrl);

      // Construct the `QuillProm` instances.
      const [titleQuill, bodyQuill] = this._quillSetup(titleNode, bodyNode);

      /** {QuillProm} The Quill editor object for the document title. */
      this._titleQuill = titleQuill;

      /** {QuillProm} The Quill editor object. */
      this._bodyQuill = bodyQuill;

      /** {CaretOverlay} The remote caret overlay controller. */
      this._caretOverlay = new CaretOverlay(this, authorOverlayNode);

      // Let the overlay do extra initialization.
      Editor.editorComplexInit(this);

      // Do session setup using the initial info.
      this._initSession(info, true);

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

  /** {CaretState} The caret state instance. */
  get caretState() {
    return this._caretState;
  }

  /** {DocSession} The session control instance. */
  get docSession() {
    return this._docSession;
  }

  /** {Logger} Logger to use when _not_ referring to the session. */
  get log() {
    return log;
  }

  /** {TitleClient} The document title client instance. */
  get titleClient() {
    return this._titleClient;
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
   * Hook this instance up to a new session.
   *
   * @param {SessionInfo} info New session info.
   */
  connectNewSession(info) {
    log.event.restarting();
    this._initSession(info, false);
  }

  /**
   * Handles "enter" key events when done on a title field.
   *
   * @param {object} metaKeys Plain object indicating which meta keys are
   *   active.
   * @returns {boolean} `false`, always, which tells Quill to stop processing.
   */
  titleOnEnter(metaKeys) {
    // **TODO:** It would be nice if this could be handled more directly by
    // `TitleClient`.
    return this._titleClient.titleOnEnter(metaKeys);
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
   * Initialize the session, based on the given session connection info.
   *
   * @param {SessionInfo} info Info object that identifies the session and
   *   grants access to it.
   * @param {boolean} fromConstructor `true` iff this call is from the
   *   constructor.
   */
  _initSession(info, fromConstructor) {
    SessionInfo.check(info);

    log.event.usingInfo(info.logInfo);

    this._sessionInfo = info;
    this._docSession  = new DocSession(this._sessionInfo);
    this._bodyClient  = new BodyClient(this._bodyQuill, this._docSession);
    this._titleClient = new TitleClient(this);

    this._bodyClient.start();
    this._titleClient.start();

    // Log a note once everything is all set up.
    (async () => {
      await this._bodyClient.when_idle();
      if (fromConstructor) {
        log.event.started();
      } else {
        log.event.restarted();
      }
    })();
  }

  /**
   * Does all of the DOM setup needed to make the indicated "top" node be
   * ready to have Quill and the author overlay attached to it.
   *
   * @param {Element} topNode The top DOM node for the complex.
   * @param {string} serverUrl URL used to contact the server.
   * @returns {array<Element>} Array of `[headerNode, titleNode, bodyNode,
   *   authorOverlayNode]`, for immediate consumption by the constructor.
   */
  async _domSetup(topNode, serverUrl) {
    const baseUrl = Urls.baseUrlFromApiUrl(serverUrl);

    // Validate the top node, and give it the right CSS style.
    if (topNode.nodeName !== 'DIV') {
      throw Errors.badUse('Expected `topNode` to be a `div`.');
    }

    topNode.classList.add('bayou-top');

    const document = topNode.ownerDocument;

    // Similarly, give the page itself the right CSS style.
    const htmlNode = document.getElementsByTagName('html')[0];
    if (!htmlNode) {
      throw Errors.wtf('No `html` node?!');
    }
    htmlNode.classList.add('bayou-page');

    // Add the stylesheet, and wait for it to finish before proceeding.
    await DomUtil.addStylesheet(document, `${baseUrl}/static/index.css`);

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
    // this section is the `<div>` managed by the Quill instance for the
    // document body. In addition, this is where the author overlay goes.

    const bodyOuterNode = document.createElement('div');
    bodyOuterNode.classList.add('bayou-body');
    topNode.appendChild(bodyOuterNode);

    // Make the `<div>` that actually ends up getting controlled by Quill for
    // the body.
    const bodyNode = document.createElement('div');
    bodyNode.classList.add('bayou-editor');
    bodyOuterNode.appendChild(bodyNode);

    // Make the author overlay node. **Note:** The wacky namespace URL is
    // required. Without it, the `<svg>` element is actually left uninterpreted.
    const authorOverlayNode =
      document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    authorOverlayNode.classList.add('bayou-author-overlay');
    bodyOuterNode.appendChild(authorOverlayNode);

    return [headerNode, titleNode, bodyNode, authorOverlayNode];
  }

  /**
   * Creates and returns the `QuillProm` instances to use with this complex.
   *
   * @param {Element} titleNode The `<div>` for title content.
   * @param {Element} bodyNode The `<div>` for body content.
   * @returns {array<QuillProm>} Array of the form `[titleQuill, bodyQuill]`.
   */
  _quillSetup(titleNode, bodyNode) {
    // Makes a clone of the default config with the additional binding of
    // the "enter" key to our special handler. **TODO:** This is way more
    // verbose and precarious than it ought to be. We should fix it to be
    // less icky.
    const titleModuleConfig = Object.assign({}, EditorComplex._titleModuleConfig);
    titleModuleConfig.keyboard = Object.assign({},
      titleModuleConfig.keyboard,
      { onEnter: this.titleOnEnter.bind(this) });

    /** {QuillProm} The Quill editor object for the document title. */
    const titleQuill = new Editor.QuillProm(titleNode, {
      readOnly: false,
      strict:   true,
      theme:    Editor.quillThemeName('title'),
      modules:  titleModuleConfig
    });

    /** {QuillProm} The Quill editor object. */
    const bodyQuill = new Editor.QuillProm(bodyNode, {
      readOnly: true,
      strict:   true,
      theme:    Editor.quillThemeName('body'),
      modules:  EditorComplex._bodyModuleConfig
    });

    return [titleQuill, bodyQuill];
  }

  /**
   * The Quill module configuration to use for the main body editor. This uses a
   * hook to get the value the first time it's needed, caching the result for
   * later reuse.
   */
  static get _bodyModuleConfig() {
    if (!EditorComplex._bodyModuleConfigValue) {
      const defaultConfig = {
        keyboard: BayouKeyHandlers.defaultKeyHandlers,
        toolbar: [
          [{ header: 1 }, { header: 2 }, { header: 3 }],
          ['bold', 'italic', 'underline', 'strike', 'link', 'code'],
          [{ list: 'bullet' }, { list: 'ordered' }, { list: 'unchecked' }],
          ['blockquote', 'code-block']
        ]
      };

      const moduleConfig = Editor.quillModuleConfig('body', defaultConfig);

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
      const defaultConfig = {
        keyboard: BayouKeyHandlers.defaultSingleLineKeyHandlers,
        toolbar: [
          ['italic', 'underline', 'strike', 'link', 'code'], // Toggled buttons.
        ]
      };

      const moduleConfig = Editor.quillModuleConfig('title', defaultConfig);

      EditorComplex._titleModuleConfigValue = Object.freeze(moduleConfig);
    }

    return EditorComplex._titleModuleConfigValue;
  }

  /**
   * Performs all one-time initialization of the system that is required before
   * the first time an instance of this class is constructed.
   */
  static _init() {
    if (EditorComplex._initialized) {
      // Already initialized.
      return;
    }

    // This does a dynamic `require` (import), because the outer definition of
    // the file needs `config-client` to be initialized, and that's not done at
    // the time that _this_ file is first loaded. Whee!
    require('./BayouKeyboard');

    EditorComplex._initialized = true;
  }
}
