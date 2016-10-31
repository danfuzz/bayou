Local Modules
=============

These are all Node modules whose source is kept within this project (that is,
not published via npm). These modules are made available to both the client
and server sides.

**Note:** These modules don't get `npm install`ed, and as such their
`package.json` files are _not_ used to find dependencies. Dependencies (if any)
have to be added explicitly to `client/package.json` or `server/package.json`
as needed.
