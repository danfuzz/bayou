// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This file is what should be included from an HTML page which wishes to
// become/embed a Bayou editor. It assumes that the `window` object (that is,
// the global context) contains the following bindings:
//
// * `BAYOU_KEY` -- The JSON-encoded form of an instance of `SplitKey`, to be
//   used to authenticate access to a particular documemt.
// * `BAYOU_NODE` -- The selector for the DOM node into which the editor should
//   be embedded.

// Disable Eslint, because this file is delivered as-is and has to be fairly
// conservative.
/* eslint-disable */

// We wrap everything in an immediately-executed function so as to avoid
// polluting the global namespace.
(function () {
  if (!(window.BAYOU_KEY && window.BAYOU_NODE)) {
    throw new Error('Missing configuration.');
  }

  // Grab the base URL out of the encoded key. This is kinda gross, but when
  // we're here we haven't yet loaded the API code, and in order to load that
  // code we need to know the base URL, whee! So we just do the minimal bit of
  // parsing needed to get the URL and then head on our merry way.
  var key = JSON.parse(window.BAYOU_KEY);
  var url = key[1]; // See `SplitKey.js`, the encoded form in particular.
  var baseUrl = (url === '*')
    ? window.location.origin
    : url.match(/^https?:\/\/[^\/]+/)[0];

  var elem;

  elem = document.createElement('link');
  elem.href = baseUrl + '/static/quill/quill.bubble.css';
  elem.rel = 'stylesheet';
  document.head.appendChild(elem);

  elem = document.createElement('script');
  elem.src = baseUrl + '/static/bundle.js';
  document.head.appendChild(elem);
}());
