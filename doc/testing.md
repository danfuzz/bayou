
Unit Tests
==========

Tests for local modules are held in a `tests` directory directly under the main
module directory. We use the Mocha test runner framework.

Chai is the assert package. It supports `should`, `expect`, and `assert` styles
of test definition.

Chai As Promised is used for wrapping test checks around promise results.

Any files in the `tests` directories that start with `test_` and end with `.js`
get included in testing runs.

### External docs

* [Mocha](https://mochajs.org)
* [Chai Asserts](http://chaijs.com)
* [Chai as Promised extensions](https://github.com/domenic/chai-as-promised)
