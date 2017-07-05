// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Hooks } from 'hooks-client';
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
   * @param {Element} quillNode DOM element to attach Quill to.
   */
  constructor(quillNode) {
    super();

    /** {Element} The DOM node which Quill manages. */
    this._quillNode = TObject.check(quillNode, Element);

    /** {QuillProm} The Quill editor object. */
    this._quill = new QuillProm(this._quillNode, {
      readOnly: true,
      strict: true,
      theme: 'bubble',
      modules: {
        toolbar: EditorComplex._toolbarConfig
      }
    });

    // Let the overlay do extra initialization.
    Hooks.theOne.quillInstanceInit(this._quill);

    Object.freeze(this);
  }

  /** {QuillProm} The Quill editor object. */
  get quill() {
    return this._quill;
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
