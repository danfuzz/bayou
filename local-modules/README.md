Local Modules
=============

These are all Node modules whose source is kept within this project (that is,
not published via npm). In general, these modules are available for use on both
the client and server sides, though not all of these modules will work in both
contexts.

### Module naming conventions

* `<name>-client` &mdash; A module that is only meant to be used on the client
  (e.g., in a web browser or SSB-ish environment).
* `<name>-core` &mdash; A module that is akin to a "base class," that is, a
  module expected to be used primarily by defining another module which expands
  on its behavior in some fashion.
* `<name>-common` &mdash; A module that contains code that is meant to be
  equally useful on both client and server sides.
* `<name>-server` &mdash; A module that is only meant to be used on the server.

These patterns are generally used only when there are multiple related
modules that are used in different environments, that is, where at least two
of the above patterns are used with the same `<name>`. _Not_ having one of
these suffixes doesn't convey any meaning about what environment(s) a module
can be used in.

* `deps-<name>` &mdash; A module whose sole purpose is to require one or more
  external modules as dependencies, specifically so that multiple local modules
  can in turn depend on it. This simplifies external dependency management. The
  `<name>` is meant to be reasonably suggestive of the territory covered by the
  particular set of dependencies being defined.

### Export conventions

Modules defined here all export a set of explicit names and _no_ default. That
is, even if there is only one export from a module, it is imported as

```javascript
import { Name } from 'the-module';
```

This makes for consistency in `import` formatting and is also trivial to
remember.

Internal to a module, the convention is a little more nuanced:

* Files are allowed to _either_ define a single class or define a collection of
  data.
* If a file defines a class, then that class is the single default export of
  the file, and there are no other exports. In this case, the file's base name
  and the class name should be the same including capitalization. For example,
  the class `FooBlort` should reside in a file named `FooBlort.js` (and notably
  not, `foo-blort.js`).
* If a file defines a collection of data, then it is exported (as with the main
  module) as a set of explicit names and _no_ default.

As a slightly special case, if a module wants to export a set of utility
functionality, it should do so by defining a utility class named `TheModule`
per se, and exported as that name.

#### Standard `index` form

The standard form of a module's main `index.js` file is to import all the
local files to be exported, followed by a single `export { ... }` statement.
Modules should be listed in sort order, except that `TheModule` is always
listed first, when present.

### Exceptions to the conventions

Because nobody and no scheme is perfect, there are no doubt exceptions to the
conventions, probably inadvertently. These should be considered opportunities
for an easy fix as opposed to being examples to emulate.

- - - - - - - - - -

```
Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
