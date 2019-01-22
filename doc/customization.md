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
  separate modules (e.g., `import Florp from 'florp'`) and local files (e.g.,
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

  * The `build` script has the following options, which in concert enable a
    variety of customization possibilities:

    * `--extra-modules=<dir>` &mdash; Specifies a directory in which to find the
      source for additional local modules, such as the ones specified in the
      `--main-*` options (and their dependencies).

    * `--main-client=<name>` and `--main-server=<name>` &mdash; These specify
      the names of the modules to use as the main entry points into the client
      and server (respectively), instead of the defaults.

    There are two main things that can be accomplished with these options:

  * The project provides a number of injectable configuration points (values,
    functions, or objects), both on the client and server side. Default
    implementations of the configurations are all no-ops or have very simple
    behavior. However, a complete system may choose to provide alternate
    implementations. See the modules `@bayou/config-*` for documentation on all
    configuration points.

    To use an alternate configuration, you can clone the default `main-client`
    or `main-server` module (both of which are pretty small), and then edit to
    provide alternate configuration.

    Should you find yourself in need of configuration beyond what is already
    provided, please file an issue (or submit a PR) to add a new configuration
    class or new member of an existing configuration class.

- - - - - - - - - -

```
Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
