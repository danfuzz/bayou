testing-server
==============

This module serves dual (but related) purposes:

* Contains general code for identifying test files within a subproduct (client
  or server).
* Contains the code needed to run server tests.

A bit of subtlety here is that it is code on the server side which prepares
the client-side testing code. This module helps with that. In that regard, it
is similar to the `client-bundle` module, which is a _server_ module responsible
for manipulating _client_ code.
