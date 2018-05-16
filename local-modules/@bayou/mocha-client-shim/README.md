@bayou/mocha-client-shim
=================

This module's sole purpose is to act as a loader proxy for Webpack so that
testing code on the client side can say `import { Mocha, describe, it, ... }
from 'mocha';` and get reasonable bindings.

See `@bayou/client-bundle.ClientBundle` for the code that gets this hooked into
the system.

- - - - - - - - - -

```
Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
