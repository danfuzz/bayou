// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This file is what should be included from an HTML page which wishes to
// become/embed a Bayou editor. It assumes that the `window` object (that is,
// the global context) contains the following bindings:
//
// * `BAYOU_INFO` -- The JSON-encoded form of an instance of `SessionInfo`, to
//   be used to identify and authenticate access to a particular document.
// * `BAYOU_NODE` -- The DOM node into which the editor should be embedded.
// * `BAYOU_RECOVER` (optional) -- Function to use when attempting to recover
//   from connection trouble. It gets passed the `SessionInfo` which was
//   initially used to establish the connection.
//
// See {@link @bayou/top-client/TopControl} for more details about these
// parameters.

// Disable Eslint, because this file is delivered as-is and has to be fairly
// conservative.
/* eslint-disable */

// We wrap everything in an immediately-executed function so as to avoid
// polluting the global namespace.
(function () {
  if (!(window.BAYOU_INFO && window.BAYOU_NODE)) {
    // **Note:** This code is run too early to be able to use
    // `@bayou/util-common`'s error facilities.
    throw new Error('Missing configuration.');
  }

  // Grab the base URL out of the encoded info. This is kinda gross, but when
  // we're here we haven't yet loaded the API code, and in order to load that
  // code we need to know the server URL, whee! So we just do the minimal bit of
  // parsing needed to get the URL and then head on our merry way. See
  // {@link @bayou/doc-common/SessionInfo}, the encoded form in particular, if
  // you want to understand what's going on.
  var info = JSON.parse(window.BAYOU_INFO);
  var serverUrl;

  if (info.SessionInfo) {
    serverUrl = info.SessionInfo[0];
  } else {
    throw new Error('Unrecognized format for `BAYOU_INFO`.');
  }

  // Get the base URL from the server URL by dropping the final `/api`. This is
  // brittle, in that it bakes in knowledge of the API endpoint.
  var baseUrl = serverUrl.replace(/[/]api$/, '');

  // Add the main JavaScript bundle to the page. Once loaded, this continues
  // the boot process. You can find its main entrypoint in
  // {@link @bayou/main-client} listed as the `main` in that module's manifest.
  var elem = document.createElement('script');
  elem.src = `${baseUrl}/static/js/main.bundle.js`;
  document.head.appendChild(elem);
}());
