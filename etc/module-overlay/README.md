Module Overlay Files
====================

This directory contains local fixes for modules that we use which we get via
`npm`. This is how we can remain unblocked while still waiting for fixes from
upstream maintainers (who aren't always the most responsive folks, so it goes).

The file `checksums.txt` is used to ensure we are only patching over the
versions of files that we're expecting.

Why don't you just publish a forked module, instead of having this wacky mechanism?
-----------------------------------------------------------------------------------

Because sometimes the problematic module isn't one we use directly, but is
instead used by Module Z, which is used by Module Y, which is used by Module
X, and it's X that we _actually_ use. So, to use our would-be fork, we would
have to fork the whole hierarchy.

In a word, ugh!

What we do here allows for isolated and tactical tweaks, which are easy to
maintain.
