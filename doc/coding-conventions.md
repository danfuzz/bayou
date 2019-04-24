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

#### Documentation comments

* We use JSDoc-style annotations on classes, methods, and properties (including
  instance variables), using `/** ... */` cladding.

* The type annotation used for arrays is `{array}` or `{array<elementType>}`,
  with a lower case `a`.

* We define a `@bayou/typecheck` module which effectively defines a few
  primitive "types" that aren't actually real types in JavaScript, most notably
  `Int` to represent primitive numbers that are in fact integers. We use these
  type names in annotations as if they were real types. The names are always
  capitalized.

* When documenting functions marked `async`, the implicit promise returned by
  the function should _not_ typically be represented in its prose or `@returns`
  documentation:

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

  As an exception, if the asynchronous behavior warrants specific detail, it
  is okay to describe that behavior (but still leave the `@returns` doc
  unmarked).

#### Module imports and exports

* There are specific conventions of how local module exports are set up. Find
  that info in the [`local-modules/` README file](../local-modules/README.md).

* `import` order &mdash; Separate imports into three sections, in the following
  order and separated with a single blank line:

  * Built-in Node modules and modules imported from the public registry.
  * Local modules defined in this product.
  * Module-private files defined as a peer to the file doing the importing.

  Within each section, sort lines alphabetically by name of file or module (not
  name within same). Within a multi-name `import` _line_, sort names
  alphabetically. Complete example:

  ```javascript
  import express from 'express';
  import fs from 'fs';

  import { BaseFile } from '@bayou/file-store';
  import { DataUtil, InfoError, Singleton } from '@bayou/util-common';

  import RegularBlort from './RegularBlort';
  import SpecialBlort from './SpecialBlort';
  ```

* `import ... as` &mdash; If you have a name conflict that needs to be resolved,
  always construct the replacement name as `<ModuleName>_<OriginalName>`, where
  the module name is the `module-name` converted to `camelCase`. Among other
  things, this preserves the ability to search for `<OriginalName>.whatever`
  (and similar searches) which might otherwise be broken (and lead to incomplete
  search-replace and therefore lead to bugs).

  ```javascript
  import { Foo as excellentModule_Foo } from 'excellent-module';
  import { Foo as supremeModule_Foo } from 'supreme-module';
  ```

#### Class definitions

* Base Classes &mdash; Base classes are typically named with the prefix `Base`.

* Private fields and methods &mdash; This project is coded as if JavaScript
  will grow the ability to have private fields and methods on classes. As such,
  an underscore (`_`) prefix is used on names that are supposed to be treated as
  private. If and when the facility is added to the language, it will be a Small
  Matter Of Coding to programmatically replace the underscored declarations and
  use sites with the real syntax.

  **Note:** This is an intentional deviation from Airbnb style.

* Method namespaces &mdash; Occasionally, it is useful to group a set of
  methods together within a class as being part of a "namespace" of some sort.
  When this is the case, the names take the form `<namespace>_<method>` where
  the namespace and method name are underscore-separated. For example, the
  file operation constructors in `@bayou/file-store-ot.FileOp` are all defined
  as `op_<name>`.

* Abstract methods &mdash; Sometimes base classes want to define abstract
  methods for their subclasses to fill in. The naming pattern for these is a
  special case of method namespaces as described above, `_impl_<method>`, where
  `<method>` is often a name that is the same as, or reasonably related to, a
  public method defined by the same class. In the base class which defines an
  abstract method, the method is written using a bit of boilerplate code which
  arranges for a reasonable error when called without having been overridden.
  Also note the use of `@abstract` in the documentation comment.

  ```javascript
  /**
   * Does something interesting.
   *
   * @abstract
   * @param ...
   * @returns ...
   */
  _impl_doSomethingInteresting(arg1, arg2) {
      return this._mustOverride(arg1, arg2);
  }
  ```

  `_mustOverride()` is defined by the class `CommonBase` in the
  `@bayou/util-common` local module.

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

* Order of definitions &mdash; The canonical ordering of definitions in class
  bodies is as follows. Within each "leaf" section, items are sorted
  alphabetically. The intent of this is to make it easy to find stuff when
  browsing the code.

  * Public properties
    * static
      * synthetic fields
      * methods
    * constructor
    * instance
      * synthetic fields
      * methods
  * Private properties
    * instance
      * implementations of `_impl_` methods (see "abstract methods" above)
      * synthetic fields
      * methods
    * static
      * implementations of `_impl_` methods (see "abstract methods" above)
      * synthetic fields
      * methods

  Roughly speaking, you can think of this as an "instance sandwich on static
  bread."

  As an exception, methods that only serve as helpers for one other method, or
  are otherwise intimately associated with that method, will sometimes get
  located immediately below the method being helped. Notable examples of this
  are the logging metadata getter methods (see `MetaHandler` for an example).

#### Enumerated constants

* Use immutable static variables to name constants instead of just using
  quoted strings directly. The name of the variable should generally match the
  content of the related string, via one of two mappings:

  * The preferred way is to use a common all-caps prefix for all the constants,
    followed by an underscore, and followed by the constant value in
    `camelCase`. For example, use the variable name `CODE_bakeCake` for the
    string `"bakeCake"` and the variable name `CODE_eatCake` for `"eatCake"` as
    part of the same enumeration.

    This way is _especially_ preferred if the string values "leak" beyond the
    code, e.g., if they end up represented in databases or get transmitted
    across an API boundary.

  * The less recommended (but still acceptable, for now) way is to convert the
    constant value to `UPPER_SNAKE_CASE` and have that be the name. For example,
    the strings of the previous example would be stored in static variables
    named `BAKE_CAKE` and `EAT_CAKE` respectively.

* The preferred way to define static constants is via static getter functions,
  e.g.:

  ```javascript
  class CakeCodes {
    static get CODE_bakeCake() { return 'bakeCake'; }
    static get CODE_eatCake()  { return 'eatCake'; }
    ...
  }
  ```

  Once JavaScript gains the ability to define these in a better way, we will
  endeavor to do so.

* Prefer `lowerCamelCase` for constant values, except if there is an external
  dependency that requires otherwise. Notably, Quill event names (like many
  Javascript event names) and CSS selectors use `lower-kebab-case`; and many
  external services use `lower_snake_case`.

#### Other items

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

* Websockets &mdash; JavaScript has a `WebSocket` class, but when talking about
  them in prose or in our own variable or class names, we use "websocket" (one
  word, all lower case, though capitalized as appropriate for prose or
  `camelCasing`). In addition, `ws` is a good choice for a shorthand name of a
  variable that contains an instance of one (or something related).

### Exceptions to the conventions

Because nobody and no scheme is perfect, there are no doubt exceptions to the
conventions, probably inadvertently. These should be considered opportunities
for an easy fix as opposed to being examples to emulate.
