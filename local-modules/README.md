Local Modules
=============

These are all Node modules whose source is kept within this project (that is,
not published via npm). In general, these modules are available for use on both
the client and server sides, though not all of these modules will work in both
contexts.

### Module naming conventions

* `<name>-common` &mdash; A module that contains code that is meant to be
  equally useful on both client and server sides.
* `<name>-client` &mdash; A module that is only meant to be used on the client.
* `<name>-server` &mdash; A module that is only meant to be used on the server.

These patterns are generally used only when there are multiple related
modules that are used in different environments, that is, where at least two
of the above patterns are used with the same `<name>`. _Not_ having one of
these suffixes doesn't convey any meaning about what environment(s) a module
can be used in.

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
  the file, and there are no other exports.
* If a file defines a collection of data, then it is exported (as with the main
  module) as a set of explicit names and _no_ default.

### Exceptions to the conventions

Because nobody and no scheme is perfect, there are no doubt exceptions to the
conventions, probably inadvertently. These should be considered opportunities
for an easy fix as opposed to being examples to emulate.

- - - - - - - - - -

```
Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
