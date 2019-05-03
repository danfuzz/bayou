// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * The `BayouKeyboard` module is a subclass of the default Quill Keyboard
 * module, but with a better system of configuring special handlers. For
 * instance, it makes it easy to override processing of just the `enter` key so
 * that you could make a Quill instance that only allows a single line of input.
 *
 * This class is a collection of those break-out handlers, as well as some
 * routines for returning bundles of handlers for specific tasks. The individual
 * handlers can be grouped manually, or the bundled groups of task-specific
 * handlers can be used as a configuration option when allocating a `QuillProm`.
 * An example of usage might be:
 *
 * ```
 * const keyHandlers = BayouKeyHandlers.defaultSingleLineKeyHandlers;
 * const quill = new QuillProm(domNode, {
 *   modules: {
 *     [ other configuration options ],
 *     keyboard: keyHandlers
 *   }
 * });
 * ```
 */
export class BayouKeyHandlers extends UtilityClass {
  /**
   * Convenience function that returns the group of key handlers that provide
   * default behavior (i.e., what you'd get from Quill if this class were not
   * installed).
   *
   * @returns {object} The key handlers.
   */
  static get defaultKeyHandlers() {
    return {
      onEnter:  BayouKeyHandlers._defaultOnEnter,
      onEscape: BayouKeyHandlers._defaultOnEscape,
      onTab:    BayouKeyHandlers._defaultOnTab
    };
  }

  /**
   * Convenience function that returns the default group of key handlers that
   * will transform a Quill instance into a single-line input field.
   *
   * @returns {object} The key handlers.
   */
  static get defaultSingleLineKeyHandlers() {
    return Object.assign(
      BayouKeyHandlers.defaultKeyHandlers,
      { onEnter: BayouKeyHandlers._singleLineOnEnter }
    );
  }

  /**
   * Gets a key handler object configured for single-line use, with additional
   * overridden key bindings as given.
   *
   * @param {object} [bindings = {}] Additional key bindings.
   * @returns {object} The key bindings as specified.
   */
  static singleLineKeyHandlers(bindings = {}) {
    return Object.assign(
      BayouKeyHandlers.defaultSingleLineKeyHandlers,
      bindings);
  }

  /**
   * Default handling for the `enter` key. This is just a pass-through that
   * allows the events to propagate back up to Quill.
   *
   * @param {object} metaKeys_unused The state of the meta-keys for this
   *   keyboard event.
   * @returns {boolean} `true`, always.
   */
  static _defaultOnEnter(metaKeys_unused) {
    return true;
  }

  /**
   * Default handling for the `escape` key. This is just a pass-through that
   * allows the events to propagate back up to Quill.
   *
   * @param {object} metaKeys_unused The state of the meta-keys for this
   *   keyboard event.
   * @returns {boolean} `true`, always.
   */
  static _defaultOnEscape(metaKeys_unused) {
    return true;
  }

  /**
   * Default handling for the `tab` key. This is just a pass-through that allows
   * the events to propagate back up to Quill.
   *
   * @param {object} metaKeys_unused The state of the meta-keys for this
   *   keyboard event.
   * @returns {boolean} `true`, always.
   */
  static _defaultOnTab(metaKeys_unused) {
    return true;
  }

  /**
   * A custom key handler for the return/enter key that blocks processing. This
   * is to support single-line text input fields.
   *
   * @param {object} metaKeys_unused The state of the meta-keys for this
   *   keyboard event.
   * @returns {boolean} `false`, always.
   */
  static _singleLineOnEnter(metaKeys_unused) {
    return false;
  }
}
