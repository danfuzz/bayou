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
