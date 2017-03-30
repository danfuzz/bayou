
Arugula Module Unit Tests
==============================

Tests for Bayou modules are held in a `tests` directory within the module.
Arugula uses the Mocha test runner framework. At present test results are dumped
to the server console output.

Chai is the assert package. It supports `should`, `expect`, and
`assert` styles of test definition.

Chai as Promised is used for wrapping test checks around promise results.

Any files in the `tests` directory that end with `.js` will be added to the
test runner.

### Other docs

* [Mocha](https://mochajs.org)
* [Chai Asserts](http://chaijs.com)
* [Chai as Promised extensions](https://github.com/domenic/chai-as-promised)
