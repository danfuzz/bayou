// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ClientHooks from 'client-hooks';
import { QuillProm } from 'quill-util';

/** Default toolbar configuration. */
const DEFAULT_TOOLBAR_CONFIG = [
  ['bold', 'italic', 'underline', 'strike', 'code'], // toggled buttons
  ['blockquote', 'code-block'],

  [{header: 1}, {header: 2}],                    // custom button values
  [{list: 'ordered'}, {list: 'bullet'}],
  [{script: 'sub'}, {script: 'super'}],          // superscript/subscript
  [{indent: '-1'}, {indent: '+1'}],              // outdent/indent

  [{size: ['small', false, 'large', 'huge']}],   // custom dropdown
  [{header: [1, 2, 3, 4, 5, 6, false]}],

  [{color: []}, {background: []}],               // dropdown with defaults from theme
  [{font: []}],
  [{align: []}],

  ['clean']                                      // remove formatting button
];

/**
 * Toolbar configuration. Set during the first instantiation of a `Quill`
 * object.
 */
let toolbarConfig = null;

/**
 * Bottleneck for constructing Quill instances. This class exists merely to make
 * it easy to configure this behavior via an overlay.
 */
export default class QuillMaker {
  /**
   * Makes an instance of `Quill`. More specifically, because we want to use
   * a promise chain to get at the edit events, this makes an instance of our
   * custom subclass `QuillProm`.
   *
   * @param {string} id DOM id of the element to attach to.
   * @returns {QuillProm} instance of `Quill`.
   */
  static make(id) {
    if (toolbarConfig === null) {
      toolbarConfig = Object.freeze(
        ClientHooks.quillToolbarConfig(DEFAULT_TOOLBAR_CONFIG));
    }

    const result = new QuillProm(id, {
      readOnly: true,
      strict: true,
      theme: 'snow',
      modules: {
        toolbar: toolbarConfig
      }
    });

    // Let the overlay do extra initialization.
    ClientHooks.quillInstanceInit(result);

    return result;
  }
}
