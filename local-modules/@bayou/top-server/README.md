@bayou/top-server
=================

This module contains most of the top level server code, including parsing of
command-line options. The intent is for this to have everything needed to
handle server invocation _except_ for injected dependencies.

**Note:** The act of importing this module causes initialization of the Babel
runtime (including hooking up polyfills) and the patching of Node's stack trace
generator to respect source maps.

- - - - - - - - - -

```
Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
