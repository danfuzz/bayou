@bayou/top-client
=================

This module contains most of the top-level client code, including a
`package.json` which is specific to the client side. That is, the modules
referenced here become available for use in the browser, but are not included on
the server side, at least not due to being referenced here.

The intent is for this module to have everything needed to handle client
bootstrap _except_ for injected dependencies.

- - - - - - - - - -

```
Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
