Client Code
===========

This directory contains all of the client code, including a `package.json`
which is specific to the client side. That is, the modules referenced here
become available for use in the browser, but are not included on the server
side, at least not due to being referenced here.

You'll find a `tsconfig.json` file here too. This is required to get the
TypeScript code from the included modules (as of this writing, just `parchment`)
to be successfully compiled.
