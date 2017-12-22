Development Guide
=================

### Directory structure

* `client` &mdash; Client code and static assets. The main client-side
  application entrypoint is `js/index.js`.
* `compiler` &mdash; Submodule used to build the server-side code, using Babel
  in an appropriately-configured manner.
* `doc` &mdash; Project documentation.
* `etc` &mdash; A dumping ground for miscellaneous files.
* `local-modules` &mdash; JavaScript module code (Node modules, essentially)
  which can be used on both the client and server sides.
* `out` &mdash; Where the results of doing a build end up (by default).
* `scripts` &mdash; Scripts for use during development (see above).
* `server` &mdash; Server code. The main entrypoint is `index.js`.

### Build and Run

Bayou uses [Node](https://nodejs.org) on the server side, and it uses
[npm](https://npmjs,com) for module management. Install both of these if you
haven't already done so. As of this writing, the bulk of development and
testing have been done using `node` version 8, and `npm` version 5. The system
will fail to build or run with earlier versions.

To build and run, say:

```
$ cd bayou
$ ./scripts/develop
```

and then visit <http://localhost:8080>. This will do a build first. If you
_just_ want to do the build, then you can say:

```
$ ./scripts/build
```

In production, run using the `run` script placed in the product's `bin`
directory:

```
$ ./out/final/bin/run
```

### Testing

The script `run-tests` will run all of the existing tests, sending output to the
console as well as saving it in files under the output directory. It takes
options which can limit it to only running specific tests. (See its `--help` for
details.)

This script wraps calls to the build script `out/final/bin/run`, passing it
various testing options. You can also call this script directly, as needed or
desired.

### Cleanup

```
$ ./scripts/clean
```

### Editor setup

You may want to install live linting into your editor.

If you use the Atom editor, the package `linter-eslint` can do that. Because
the project uses React and JSX, the easiest way to get linting to work is to
use npm to globally install ESLint and its React plugin, and configure Atom
`linter-eslint` to use that:

```
$ npm install -g eslint eslint-plugin-react
```

- - - - - - - - - -

```
Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
