// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';
import { HorizontalRule } from 'ui-embeds';
import { UtilityClass } from 'util-core';

import BayouKeyboard from './BayouKeyboard';

export default class TextReplacement extends UtilityClass {
  /**
   * Adds custom keyboard bindings to the Quill editor for that
   * trigger text replacement.
   *
   * @param {Quill} quill the Quill editor to add the binding to.
   */
  static addKeybindings(quill) {
    TextReplacement.addHRKeybinding(quill);
  }

  /**
   * Adds a keyboard binding to the Quill editor for embedding
   * an `<hr>` element. It is triggerd by typing three hyphens
   * and then whitespace.
   *
   * @param {Quill} quill The Quill instance to add the binding to.
   */
  static addHRKeybinding(quill) {
    const hrBinding = (range, context_unused) => {
      // Delete the three hyphens
      quill.deleteText(range.index - 3, 3);

      // Insert the <hr>
      quill.insertEmbed(range.index - 3, HorizontalRule.blotName, true, Quill.sources.USER);

      // Move the insertion point to just past the <hr>. (Skipping one
      // character position for the embed, and one for the \n that quill
      // inserts after the embed).
      quill.setSelection(range.index - 1, 0, Quill.sources.SILENT);

      // Don't allow the trigger space into the document body.
      return false;
    };

    const hrPattern = /---$/;

    quill.keyboard.addBinding(
      { key: BayouKeyboard.KEYMAP.SPACE },
      { prefix: hrPattern },
      hrBinding
    );

    quill.keyboard.addBinding(
      { key: BayouKeyboard.KEYMAP.ENTER },
      { prefix: hrPattern },
      hrBinding
    );
  }
}
