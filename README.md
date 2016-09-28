Quillex
=======

A little Quill demo web application. The code is set up to make it
straightforward to customize. Salient details:

* Quill and its dependencies get built from source, instead of being used in
  the precompiled distro form which Quill provides as a convenience. This makes
  it possible to use Quill and Parchment (and the other dependencies) from
  custom code without ending up with duplicated code and punned definitions.

* All of the client-side code gets transformed into a single bundle, using
  [Webpack](https://webpack.github.io/). It is set up in a "live development"
  configuration, where changes to source files cause the bundle to be recompiled
  on the fly.

* Custom code can be written in either ES2017 (with a `.js` suffix) or
  [TypeScript](https://www.typescriptlang.org/) (with a `.ts` suffix). Modern
  `import` syntax works both for separate modules (e.g.,
  `import Quill from 'quill'`) and local files (e.g.,
  `import { thing } from './thing'`).

  * ES2017 is compiled into conservative JavaScript by
    [Babel](https://babeljs.io/).

  * TypeScript is compiled into conservative JavaScript by the standard
    TS compiler, hooked up to Webpack using
    [`ts-loader`](https://www.npmjs.com/package/ts-loader).

### Build and Run

```
$ npm install
$ npm start
```

and then visit <http://localhost:9001>.

### Cleanup

```
$ npm run clean
```

### Directory structure

* `client` &mdash; Client code and static assets. The main client-side
  application entrypoint is `js/app.js`.
* `server` &mdash; Server code. The main entrypoint is `main.js`.

### Other information

* [Authors](AUTHORS.md) (and acknowledgments)
* [Contributing](CONTRIBUTING.md)
* [License](LICENSE.md)

```
Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
