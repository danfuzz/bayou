@bayou/testing-server
=====================

This module serves multiple related purposes:

* Identifying test files within a subproduct (client or server).
* Directly running server tests.
* Arm's-length running of client tests via a captive browser.

A bit of subtlety here is that it is code on the server side which prepares
the client-side testing code. This module helps with that. In that regard, it
is similar to the `@bayou/client-bundle` module, which is a _server_ module
responsible for manipulating _client_ code.

- - - - - - - - - -

```
Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
