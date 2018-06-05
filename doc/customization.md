Customization
=============

Bayou is set up to make it straightforward to customize. Salient details:

* Quill and its dependencies get built from source, instead of being used in
  the precompiled distro form which Quill provides as a convenience. This makes
  it possible to use Quill and Parchment (and the other dependencies) from
  custom code without ending up with duplicated code and punned definitions.

* All of the client-side code gets transformed into a single bundle, using
  [Webpack](https://webpack.github.io/). It is set up in a "live development"
  configuration, where changes to source files cause the bundle to be recompiled
  on the fly.

* Custom client code can be written in either ES2017 (with a `.js` suffix) or
  [TypeScript](https://www.typescriptlang.org/) (with a `.ts` suffix). Custom
  server code can be written in ES2017. Modern `import` syntax works both for
  separate modules (e.g., `import Quill from 'quill'`) and local files (e.g.,
  `import { thing } from './thing'`).

  * ES2017 is compiled into conservative JavaScript by
    [Babel](https://babeljs.io/).

  * TypeScript is compiled into conservative JavaScript by the standard
    TS compiler, hooked up to Webpack using
    [`ts-loader`](https://www.npmjs.com/package/ts-loader).

* [Express](https://expressjs.com/) is used as the HTTP server and associated
  plumbing.

* The product defines and uses a structured (though as yet not particularly
  well-specified) API for communication between client and server. It uses a
  websocket for transport, using it to pass JSON-encoded API calls and
  responses. As of this writing, the server side only _barely_ does anything
  nontrivial. The intention is to continue expanding the server-side
  functionality over time.

* This project is meant to form the core for a more complete product that
  integrates into a larger system. As such, it intentionally punts on document
  storage, user authentication, and the like. Instead, the project provides
  mechanisms to help integrate these things without having to fork the original
  source code:

  * The `build` script takes an optional `--overlay` option, which specifies
    a directory to use for additional sources. There are two main things that
    can be accomplished with overlays. Namely…

  * The project provides a number of injectable configuration points (values,
    functions, or objects), both on the client and server side. Default
    implementations of the configurations are all no-ops or have very simple
    behavior. However, a complete system may choose to provide alternate
    implementations. See the modules `@bayou/config-*` for documentation on all
    configuration points.

    **Note:** The system is currently in transition from a source-overlay-based
    hooks mechanism, which is similar in intent but "upside down" in
    implementation. **TODO:** Remove this note once the system is completely
    converted to the new configuration mechanism.

  * Because no amount of explicit configuration hooks will ever turn out to be
    fully adequate, any original source file at all can be overridden with a
    replacement. This probably means a lot of copy-paste code duplication, but
    it will at least unblock progress while still allowing the upstream source
    to remain unforked. Should you find yourself in need of this facility,
    please do not hesitate to file an issue, as this is a good indicator that
    the project is in need of a refactoring, and possibly a new configuration
    point, to cover the use case in question.

- - - - - - - - - -

```
Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
