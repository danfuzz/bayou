hooks-client
============

This module contains all the "official" customization hooks that are made
available on the client side.

The default implementation suffices for developing Bayou in a standalone
fashion, but by and large it won't work for real production use.

A downstream product should replace this module (or parts) with implementations
that are more appropriate for deploying that product by the downstream
organization.

### How to override

If you want to override this module in a clean way, here's what to do:

* Make sure you have an overlay set up. See the main documentation for
  information on how to do that.
* Make a `local-modules` directory for this module, that is `hooks-client`. Copy
  `package.json` and `Hooks.js` from this directory into it.
* Add new dependencies to the overridden `package.json`.
* Place new implementations into `Hooks.js`.
