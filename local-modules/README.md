Local Modules
=============

These are all Node modules whose source is kept within this project (that is,
not published via npm). In general, these modules are available for use on both
the client and server sides, though not all of these modules will work in both
contexts.

### Module naming conventions

#### Suffixes

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

#### Prefixes

* `deps-<name>` &mdash; A module whose sole purpose is to require one or more
  external modules as dependencies, specifically so that multiple local modules
  can in turn depend on it. This simplifies external dependency management. The
  `<name>` is meant to be reasonably suggestive of the territory covered by the
  particular set of dependencies being defined.

* `main-<name>` &mdash; A module which is the "main" (entry point) of a major
  subsystem. The `main-*` modules form the root of the dependency graph for the
  system as a whole.

### Export conventions

Modules defined here all export a set of explicit names and _no_ default. That
is, even if there is only one export from a module, it is imported as:

```javascript
import { Name } from 'the-module';
```

This includes module-internal files which define classes:

```javascript
import { ClassName } from './ClassName';
```

This makes for consistency in `import` formatting (trivial to remember), is less
error-prone (can't import a thing with the wrong name, compared to using a
`default`), and better supports typechecking systems (such as TypeScript).

As a slightly special case, if a module wants to export a set of utility
functionality which has no reasonable more-specific name, it should do so by
defining a utility class named `TheModule` per se, and exported as that name.

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
Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
