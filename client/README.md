Client Code
===========

This directory contains all of the client code, including a `package.json`
which is specific to the client side. That is, the modules referenced here
become available for use in the browser, but are not included on the server
side, at least not due to being referenced here.

### Note about `parchment`

The `parchment` module is written in TypeScript. The conversion of its code into
regular JavaScript is accomplished by `ClientBundle.js` on the server side.
Note in particular that the TypeScript configuration there has to be compatible
with how `parchment` wants to be built. That is, be wary of changes to
`parchment` which require reconfiguration of the build process.
