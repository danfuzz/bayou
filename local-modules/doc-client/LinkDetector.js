// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BayouKeyboard } from 'quill-util';
import { ImageEmbed } from 'ui-embeds';

// Originally imported from <https://gist.github.com/dperini/729294>, by
// Diego Perini and licensed under the MIT License. **TODO:** Consider using a
// newer implementation, such as the Node module `url-regex`
// <https://github.com/kevva/url-regex>, which is based on the same gist.
const OPTIONAL_PROTOCOL_URL_REGEXP =
  /((?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?/i;

/**
 * Detector of URLs typed / pasted into a Quill document.
 */
export default class LinkDetector {
  /**
   * Adds keyboard bindings to the Quill editor for basic link detection.
   *
   * @param {Quill} quill the Quill editor to add the binding to.
   */
  static addKeybindings(quill) {
    const linkBinding = function (range, context) {
      const matches = [];

      // Gather all the link so we can later pull out just the last one. We're
      // not actually replacing anything here, but this is so much tidier than
      // `/regex/.exec()` calls in a loop. If a given link doesn't have a
      // protocol then the Quill Link format will treat it as a relative path
      // off the current host. So, if there is no protocol then assume HTTP.
      context.prefix.replace(OPTIONAL_PROTOCOL_URL_REGEXP, (matchedText, protocol) => {
        matches.push({
          regexMatch: matchedText,
          link:       protocol ? matchedText : `http://${matchedText}`
        });
      });

      const lastMatch = matches.pop();
      const index = range.index - lastMatch.regexMatch.length;

      if (LinkDetector.isImageUrl(lastMatch.regexMatch)) {
        const value = { url: lastMatch.link };

        this.quill.deleteText(index, lastMatch.regexMatch.length);
        this.quill.insertEmbed(index, ImageEmbed.blotName, value);
      } else {
        this.quill.formatText(index, lastMatch.regexMatch.length, 'link', lastMatch.link, 'user');
      }

      return true;
    };

    quill.keyboard.addBinding(
      { key: BayouKeyboard.KEYMAP.SPACE },
      { prefix: OPTIONAL_PROTOCOL_URL_REGEXP },
      linkBinding);

    quill.keyboard.addBinding(
      { key: BayouKeyboard.KEYMAP.ENTER },
      { prefix: OPTIONAL_PROTOCOL_URL_REGEXP },
      linkBinding);
  }

  /**
   * Indiates whether or not the given URL names an image, as determined by file
   * extension.
   *
   * @param {string} url URL to inspect.
   * @returns {boolean} `true` iff `url` names an image.
   */
  static isImageUrl(url) {
    const link = new URL(url);
    let extension = link.pathname.split('.').pop();

    extension = extension && extension.toLowerCase();

    return ['gif', 'jpg', 'jpeg', 'png', 'svg'].includes(extension);
  }
}
