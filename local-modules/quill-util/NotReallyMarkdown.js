// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from 'see-all';
import { UtilityClass } from 'util-core';

import QuillEvents from './QuillEvents';

const log = new Logger('not-md');

export default class NotReallyMarkdown extends UtilityClass {
  static addKeybindings(quill) {
    log.detail('Adding default not-really-markdown key bindings.');

    NotReallyMarkdown.addFormattingKeybinding(quill, '`', { key: 192, shiftKey: false }, 'code');
    NotReallyMarkdown.addFormattingKeybinding(quill, '*', { key:  56, shiftKey:  true }, 'bold');
    NotReallyMarkdown.addFormattingKeybinding(quill, '_', { key: 189, shiftKey:  true }, 'italic');
    NotReallyMarkdown.addFormattingKeybinding(quill, '~', { key: 192, shiftKey:  true }, 'strike');
  }

  /**
   * Adds a keyboard binding to the Quill editor for simple on/off formatting
   * (bold, italic, etc). Because Quill binding prefixes don't expand beyound
   * style runs you can't nest bindings. (e.g. typing '`~*_trying to get italic,
   * bold, strikethrough code_*~`' will only get you the italic and the bold
   * won't happen when you type the closing '*');
   *
   * @param {Quill} quill the Quill editor to add the binding to.
   * @param {string} marker a single-character string holding the formatting
   *   character.
   * @param {Object} binding a Quill keyboard module binding definition. See
   *   {@link https://quilljs.com/docs/modules/keyboard/} for binding details.
   * @param {string} format the name of the format to be applied.
   */
  static addFormattingKeybinding(quill, marker, binding, format) {
    if (marker.length !== 1) {
      return;
    }

    const prefixRegex = `\\${marker}(.+)$`;  //  e.g. /\*(.+)$/
    const context = { prefix: new RegExp(prefixRegex) };

    quill.keyboard.addBinding(binding, context, function (keyRange, keyContext) {

      //  If we've applied a style and then the user goes back and types the
      //  marker character inside the style run we don't want to do any
      //  additional processing.
      if (keyContext.format[format]) {
        return true;
      }

      const firstMarker = keyContext.prefix.lastIndexOf(marker);
      const text = keyContext.prefix.substring(firstMarker + 1);
      const matchLength = 1 + text.length;
      const index = keyRange.index - matchLength;

      //  Delete the opening marker
      this.quill.deleteText(index, 1, QuillEvents.SOURCE_user);

      //  Add the format to the text between the markers
      this.quill.formatText(index, text.length, { [format]: true }, QuillEvents.SOURCE_user);

      //  Turn format formatting off at the cursor so that it doesn't get
      //  extended if the user keeps typing at that location.
      this.quill.format(format, false, QuillEvents.SOURCE_user);

      //  Don't allow the trigger character into the document.
      return false;
    });
  }
}
