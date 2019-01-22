@bayou/util-core
================

This module provides the lowest layer utility functionality of the system. The
module only exists so as to avoid a circular dependency between the modules
`@bayou/typecheck` and `@bayou/util-common`. In general, it shouldn't be used
directly. Its functionality is more "publicly" exposed via `@bayou/util-common`
(and a little via `@bayou/typecheck`).

The dependency relationship is:

* `@bayou/util-core` has no dependencies.
* `@bayou/typecheck` depends on `@bayou/util-core`.
* `@bayou/util-common` depends on both `@bayou/util-core` and
  `@bayou/typecheck`.

- - - - - - - - - -

```
Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
