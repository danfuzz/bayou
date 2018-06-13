// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This file is included by the `/client-test` debugging endpoint and is used
// to actually kick off the tests.

// Disable Eslint, because this file is delivered as-is and has to be fairly
// conservative.
/* eslint-disable */

// We wrap everything in an immediately-executed function so as to avoid
// polluting the global namespace.
(function () {
  // Add the main JavaScript bundle to the page. Once loaded, this continues
  // the test-running procedure. You can find its main entrypoint in
  // {@link @bayou/main-client} listed as the `testMain` in that module's
  // manifest.
  var baseUrl = window.location.origin;
  var elem = document.createElement('script');
  elem.src = baseUrl + '/static/js/test.bundle.js';
  document.head.appendChild(elem);
}());
