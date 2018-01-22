// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Clock } from 'ui-embeds';
import { UtilityClass } from 'util-core';

import QuillEvents from './QuillEvents';

/**
 * This class handles the processing of text macros within sources
 * editor environment. Macros are pieces of text delimited by
 * dollar signs. (e.g. $clock$). If a macro command takes arguments
 * they should be separated by colons (e.g. $ticker:aapl$).
 */
export default class Macros extends UtilityClass {
  /**
   * Adds a keyboard binding to the Quill editor for macro detection.
   *
   * @param {Quill} quill the Quill editor to add the binding to.
   */
  static addKeybindings(quill) {
    const marker = '$';
    const binding = { key:  52, shiftKey:  true };
    const format = 'macro';
    const prefixRegex = `\\${marker}(.+)$`;  //  e.g. /\*(.+)$/
    const context = { prefix: new RegExp(prefixRegex) };

    quill.keyboard.addBinding(binding, context, (keyRange, keyContext) => {
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

      // Delete the opening marker
      quill.deleteText(index, 1, QuillEvents.SOURCE_user);

      // Delete the macro name
      quill.deleteText(index, text.length, QuillEvents.SOURCE_user);

      // Pick the right component
      const args = text.split(':');
      const macro = args.shift();
      let component = null;
      const value = {};

      switch (macro) {
        case 'clock': {
          component = Clock;
          break;
        }
      }

      if (component) {
        quill.insertEmbed(index, component.blotName, value);
      }

      //  Don't allow the trigger character into the document.
      return false;
    });
  }
}
