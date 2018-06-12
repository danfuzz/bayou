@bayou/config-server
====================

This module contains convenient accessors (and documentation) for all the
injected configuration that is required just on the serve sides of the system.

**Note:** The implementation of this module intentionally defers grabbing
injected configuration until the moment of use, so as to give the main
application the maximum possible amount of time and leeway to set things up.

**TODO:** This module is extremely boilerplate-y, and should instead be
table-driven by utility functionality in `@bayou/injecty` (to be written).
