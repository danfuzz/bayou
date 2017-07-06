// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Hooks } from 'hooks-client';
import { AuthorOverlay } from 'remote-authors';
import { TObject } from 'typecheck';
import { CommonBase } from 'util-common';

import QuillProm from './QuillProm';

/** Default toolbar configuration. */
const DEFAULT_TOOLBAR_CONFIG = [
  ['bold', 'italic', 'underline', 'strike', 'code'], // toggled buttons
  ['blockquote', 'code-block'],

  [{ list: 'ordered' }, { list: 'bullet' }],

  [{ header: [1, 2, 3, 4, false] }],

  [{ align: [] }],

  ['clean']                                      // remove formatting button
];

/**
 * Manager for the "complex" of objects and DOM nodes which in aggregate form
 * the editor UI.
 */
export default class EditorComplex extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Element} topNode DOM element to attach the complex to.
   */
  constructor(topNode) {
    super();

    /** {Element} DOM element the complex is attached to. */
    this._topNode = TObject.check(topNode, Element);

    // Validate the top node.
    if (topNode.nodeName !== 'DIV') {
      throw new Error('Expected `topNode` to be a `div`.');
    }

    // Do all of the DOM setup for the instance.
    const [quillNode, authorOverlayNode] =
      EditorComplex._doSetupForNode(topNode);

    /** {Element} The DOM node which Quill manages. */
    this._quillNode = quillNode;

    /** {Element} The DOM node which is used for author overlay. */
    this._authorOverlayNode = authorOverlayNode;

    /** {QuillProm} The Quill editor object. */
    this._quill = new QuillProm(quillNode, {
      readOnly: true,
      strict: true,
      theme: 'bubble',
      modules: {
        toolbar: EditorComplex._toolbarConfig
      }
    });

    /** {AuthorOverlay} The author overlay controller. */
    this._authorOverlay =
      new AuthorOverlay(this._quill, this._authorOverlayNode);

    // Let the overlay do extra initialization.
    Hooks.theOne.quillInstanceInit(this._quill);

    Object.freeze(this);
  }

  /** {AuthorOverlay} The author overlay controller. */
  get authorOverlay() {
    return this._authorOverlay;
  }

  /** {Element} The DOM node that the author overlay manages. */
  get authorOverlayNode() {
    return this._authorOverlayNode;
  }

  /** {QuillProm} The Quill editor object. */
  get quill() {
    return this._quill;
  }

  /** {Element} The DOM node that Quill manages. */
  get quillNode() {
    return this._quillNode;
  }

  /**
   * Does all of the DOM setup needed to make the indicated "top" node be
   * ready to have Quill and the author overlay attached to it.
   *
   * @param {Element} topNode The top DOM node for the complex.
   * @returns {array<Element>} Array of `[quillNode, authorOverlayNode]`, for
   *   immediate consumption by the constructor.
   */
  static _doSetupForNode(topNode) {
    topNode.classList.add('bayou-top');

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

    return [quillNode, authorOverlayNode];
  }

  /**
   * The toolbar configuration to use. This uses a hook to get the value the
   * first time it's needed, caching the result for later reuse.
   */
  static get _toolbarConfig() {
    if (!EditorComplex._toolbarConfigValue) {
      EditorComplex._toolbarConfigValue = Object.freeze(
        Hooks.theOne.quillToolbarConfig(DEFAULT_TOOLBAR_CONFIG));
    }

    return EditorComplex._toolbarConfigValue;
  }
}
