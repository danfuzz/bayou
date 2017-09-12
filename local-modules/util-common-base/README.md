util-common-base
================

This module provides the lowest layer utility functionality of the system. The
module only exists so as to avoid a circular dependency between the modules
`typecheck` and `util-common`. In general, it shouldn't be used directly. Its
functionality is more "publicly" exposed via `util-common` (and a little via
`typecheck`).

The dependency relationship is:

* `util-common-base` has no dependencies.
* `typecheck` depends on `util-common-base`.
* `util-common` depends on both `util-common-base` and `typecheck`.

- - - - - - - - - -

```
Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
