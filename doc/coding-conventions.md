Coding Conventions
==================

_(also known as the **Ledger of Arbitrary Decisions**)_

### Base JavaScript style

Bayou uses a JavaScript style which is trending towards (but is not exactly)
the style defined by the [Airbnb JavaScript Style
Guide](http://airbnb.io/javascript/).

Highlights of the style:

* two-space indents

* semicolon-terminated statements

* single-quoted strings

* Java-ish bracing and spacing (K&amp;R / [1TBS](https://en.wikipedia.org/wiki/Indent_style#Variant:_1TBS_.28OTBS.29)
  variant)

As an historical note, the project originally intended to approximate the
style described by the [Google JavaScript Style
Guide](https://google.github.io/styleguide/javascriptguide.xml). However, the
Airbnb style turns out to hew more closely to modern trends, including notably
taking into account recent additions to the language.

### Other conventions in this codebase

* There are specific conventions of how local module exports are set up. Find
  that info in the [`local-modules/` README file](../local-modules/README.md).

* Websockets &mdash; JavaScript has a `WebSocket` class, but when talking about
  them in prose or in our own variable or class names, we use "websocket" (one
  word, all lower case, though capitalized as appropriate for prose or
  `camelCasing`). In addition, `ws` is a good choice for a shorthand name of a
  variable that contains an instance of one (or something related).

* When documenting functions marked `async`, the implicit promise returned by
  the function should _not_ be represented in its prose or `@returns`
  documentation. For example:

  ```javascript
  /**
   * Returns the frobnicator string.
   *
   * @returns {string} The frobnicator.
   */
  async function frob() {
    return 'frobnicator';
  }
  ```

  As a counterexample:

  ```javascript
  // DO NOT DO THIS!
  /**
   * Eventually returns the frobnicator string.
   *
   * @returns {Promise<string>} Promise for the frobnicator.
   */
  async function frob() {
    return 'frobnicator';
  }
  ```

* Utility classes &mdash; Utility classes are classes which only serve as a
  collection of functionality exposed as static methods (and sometimes static
  properties). Utility classes should be defined as `extends UtilityClass` both
  to document the intent and to provide enforced guarantees.

  **Note:** Preferably, utility classes are _not_ a vector for exposing
  application state and are merely holders of "pure" functionality. For a
  utility-like class that maintains and/or exposes state, it is better to use
  a singleton.

* Singleton classes &mdash; Singleton classes are classes which should only
  ever have a single instance within the system. These should be defined as
  `extends Singleton` both to document the intent and to provide enforced
  guarantees. Additionally, instead of explicitly constructing singletons,
  the convention is to use the static property `theOne` on the so-defined class.

* Immediate-async blocks &mdash; When programming in the `async`/`await` style,
  sometimes it's useful to to "spawn" an independent thread of control which
  doesn't block the main execution of a method. Were JavaScript more mature,
  this would probably be represented by syntax along the lines of:

  ```javascript
  // DO NOT DO THIS! _NOT_ ACTUAL JAVASCRIPT SYNTAX.
  function blort() {
    const x = async {
      // These don't block the outer function from running. `x` is a promise
      // that resolves to `thing3` once the asynchronous operations are
      // complete.
      await thing1;
      await thing2;
      return thing3;
    }
    ...
  }
  ```

  Though a bit more verbose and less obvious, the same result can be achieved
  with an immediately-invoked anonymous function. This pattern is used
  throughout the project:

  ```javascript
  function blort() {
    const x = (async () => {
      // These don't block the outer function from running. `x` is a promise
      // that resolves to `thing3` once the asynchronous operations are
      // complete.
      await thing1;
      await thing2;
      return thing3;
    })();
    ...
  }
  ```
