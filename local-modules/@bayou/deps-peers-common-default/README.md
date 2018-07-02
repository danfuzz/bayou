@bayou/deps-peers-client-default
================================

This module just serves as a single location to hold all of the default peer
dependencies that are applicable to both the client and server sides.

### What's this all about?

Bayou is somewhat lenient in which versions of some packages it requires, but by
default we want to track the latest version. We express this "tension" by
specifying a lenient version under `peerDependencies` in `deps-*-common` and
as a version that stays more up-to-date in _this_ module.
