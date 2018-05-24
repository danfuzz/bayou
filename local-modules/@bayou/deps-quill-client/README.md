@bayou/deps-quill-client
========================

This module just serves as a single location to hold all of the client-only
Quill dependencies.

### Note about `parchment`

The `parchment` module, which is a dependency of Quill, is written in
TypeScript. The conversion of its code into regular JavaScript is accomplished
by `ClientBundle.js` on the server side. Note in particular that the TypeScript
configuration there has to be compatible with how `parchment` wants to be built.
That is, be wary of changes to `parchment` which require reconfiguration of the
build process.
