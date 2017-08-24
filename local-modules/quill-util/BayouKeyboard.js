// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';

import { ClientEnv } from 'env-client';

// **TODO:** Maybe this can be a regular `import`?
const Keyboard = Quill.import('modules/keyboard');

/** {object} Map from key names to integer keycodes. */
const KEYMAP = Object.freeze({
  TAB:     9,
  ESCAPE: 27,

  ENTER:  13,
  SPACE:  32,

  END:    35,
  HOME:   36,

  LEFT:   37,
  UP:     38,
  RIGHT:  39,
  DOWN:   40
});

/** No-op function, used for the `DEFAULT_OPTIONS`. */
function noop() {
  // This space intentionally left blank.
}

/**
 * {object} A collection of no-op keyboard key handlers. This is the base over
 * which custom options are layered.
 */
const DEFAULT_OPTIONS = {
  bindings:   {},
  onEnter:    noop,
  onEscape:   noop,
  onTab:      noop
};

/**
 * Additional Quill key bindings for macOS environments. There are several
 * references to `this.quill` in these handlers. That property will be filled in
 * by other layers before the handlers are called. It is guaranteed to be set.
 *
 * @returns {object} Mac-specific bindings for use when configuring Quill.
 */
const MAC_SPECIFIC_BINDINGS = Object.freeze({
  home: {
    key: KEYMAP.HOME,
    handler() {
      // Set selection to beginning of document.
      this.quill.setSelection(0, 0);
    },
  },

  shiftHome: {
    key: KEYMAP.HOME,
    shiftKey: true,
    handler(range) {
      // Expand selection to the start of the document.
      this.quill.setSelection(0, range.index + range.length);
    },
  },

  end: {
    key: KEYMAP.END,
    handler() {
      // Set selection to the end of the document.
      this.quill.setSelection(this.quill.getLength(), 0);
    },
  },

  shiftEnd: {
    key: KEYMAP.END,
    shiftKey: true,
    handler(range) {
      // Expand selection to to the end of the document.
      this.quill.setSelection(range.index, this.quill.getLength() - range.index);
    },
  }
});

/**
 * A subclass of the Quill keyboard module. The purpose of this subclass is to
 * extend Quill with methods such as `onEnter(metaKeys)`, `onEscape(metaKeys)`,
 * etc. so that custom behaviors for various configurations can be defined
 * merely by passing in an appropriately named function to override the default
 * handler behavior.
 *
 * For instance, if you wanted a version of the editor that only allowed a
 * single line of input then you'd only need to pass in a configuration object
 * that overrides `onEnter(metaKeys)` so that it ignored the return/enter key.
 * This greatly simplifies the process of modifying keyboard behavior.
 */
export default class BayouKeyboard extends Keyboard {
  /**
   * {object} Map from key names to integer keycodes. This is a frozen
   * (immutable) value.
   */
  static get KEYMAP() {
    return KEYMAP;
  }

  /**
   * Constructs an instance.
   *
   * @param {Quill} quill The quill instance to attach to.
   * @param {object} options Key handling configuration options.
   */
  constructor(quill, options) {
    let opts = options;

    opts = Object.assign({}, DEFAULT_OPTIONS, opts);

    // Get the bindings that run before Quill's own.
    const earlyBindings = BayouKeyboard._getEarlyBindings(opts);
    opts.bindings = Object.assign({}, opts.bindings, earlyBindings);

    // Add our events before Quill has a chance to add its own.
    quill.root.addEventListener('keydown', (e) => {
      // Quill will not stop propagation on keyboard events. Hitting HOME or END
      // will result in the editor window scrolling up or down unless we
      // specifically stop propagation on those events.
      if (   (e.keyCode === KEYMAP.HOME || e.keyCode === KEYMAP.END)
          && (quill.getLength() > 1)) {
        e.stopPropagation();
      }
    });

    super(quill, opts);

    const lateBindings = BayouKeyboard._getLateBindings(opts);

    Object.keys(lateBindings).forEach((name) => {
      this.addBinding(lateBindings[name]);
    });
  }

  /**
   * Given full configuration options, return the key bindings that should run
   * before default Quill bindings.
   *
   * Most notably, Quill by default will swallow (act on and not propagate)
   * `enter` key events, and we want to be able to override that behavior.
   *
   * @param {object} options The configuration options.
   * @returns {object} The early bindings.
   */
  static _getEarlyBindings({ onEnter, onTab }) {
    const bindings = {
      enter: {
        key: KEYMAP.ENTER,
        context: {
          empty: false,
        },
        handler: () => onEnter()
      },

      shiftEnter: {
        key: KEYMAP.ENTER,
        shiftKey: true,
        context: {
          empty: false,
        },
        handler: () => onEnter({ shiftKey: true })
      },

      optionEnter: {
        key: KEYMAP.ENTER,
        altKey: true,
        handler: () => onEnter({ altKey: true })
      },

      ctrlEnter: {
        key: KEYMAP.ENTER,
        ctrlKey: true,
        handler: () => onEnter({ ctrlKey: true })
      },

      tab: {
        key: KEYMAP.TAB,
        handler: () => onTab({ shiftKey: false })
      },

      shiftTab: {
        key: KEYMAP.TAB,
        shiftKey: true,
        handler: () => onTab({ shiftKey: true })
      },
    };

    if (ClientEnv.isMac()) {
      return Object.assign(bindings, MAC_SPECIFIC_BINDINGS);
    }

    return bindings;
  }

  /**
   * Given full configuration options, return the key bindings that should run
   * after default Quill bindings.
   *
   * @param {object} options The configuration options.
   * @returns {object} The late bindings.
   */
  static _getLateBindings({ onEscape }) {
    return {
      escape: {
        key: KEYMAP.ESCAPE,
        handler: () => onEscape()
      }
    };
  }
}
