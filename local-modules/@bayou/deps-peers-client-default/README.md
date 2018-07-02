@bayou/deps-peers-client-default
================================

This module just serves as a single location to hold all of the default peer
dependencies that are client-specific.

### What's this all about?

Bayou is somewhat lenient in which versions of some packages it requires, but by
default we want to track the latest versions and indicate our belief of
compatibility with those latest versions. We express this "tension" by
specifying a lenient version under `peerDependencies` in `deps-*-client` and
as a version that stays more up-to-date in _this_ module.
