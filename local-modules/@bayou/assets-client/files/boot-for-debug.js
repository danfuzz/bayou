// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This file is included by the `/edit/*` debugging endpoints. What it does is
// arrange to get called if/when the editor decides it needs to recover (e.g.
// and most likely because the developer restarted their local server). Beyond
// that, it _also_ kicks off loading of the regular bootstrap code.

// Inform ESLint about the special globals used by this file.
/* global DEBUG_AUTHOR_ID DEBUG_DOCUMENT_ID */

/**
 * This global function is what ultimately gets called to attempt recovery. In
 * this case, we rely on the `/access/*` debugging endpoints to generate new
 * access info. If that's successful, we report it back up through the layers.
 *
 * @param {object} info Information about how to connect to the session.
 * @returns {Promise<object>} Replacement session info, to use when next
 *   attempting to connect.
 */
window.BAYOU_RECOVER = function BAYOU_RECOVER(info) {
  const documentId = DEBUG_DOCUMENT_ID;
  const authorId   = DEBUG_AUTHOR_ID;

  // Get the base URL from the server URL by dropping the final `/api`. This is
  // brittle, in that it bakes in knowledge of the API endpoint.
  const baseUrl = info.serverUrl.replace(/[/]api$/, '');
  const url     = `${baseUrl}/debug/access/${documentId}/${authorId}`;

  return new Promise((resolve) => {
    const req = new XMLHttpRequest();
    req.open('GET', url);
    req.send();
    req.addEventListener('abort', reloadPage);
    req.addEventListener('error', reloadPage);
    req.addEventListener('load', gotInfo);

    // If there's any trouble, we just ask the window to reload. This will
    // almost certainly work but is definitely a last-resort hail-mary kind of
    // thing.
    function reloadPage() {
      window.location.reload(true);
    }

    // On successful request completion, check to see if we actually got good
    // data. If so, report it back. If not, fall back to `reloadPage()`.
    function gotInfo() {
      if (req.status === 200) {
        resolve(req.response);
      } else {
        reloadPage();
      }
    }
  });
};

// Once the rest of the page is loaded, find the DOM node for the editor, and
// arrange for the main boot script to load and run.
window.addEventListener('load', () => {
  // This is the node that is IDed specifically in `DebugTools._handle_edit`.
  const editorNode = document.querySelector('#debugEditor');
  if (!editorNode) {
    // Indicates a bug either here or in `DebugTools`. **Note:** This code is
    // run too early to be able to use `@bayou/util-common`'s error facilities.
    throw new Error('Could not find editor node!');
  }

  // This gets used by `boot-from-info`.
  window.BAYOU_NODE = editorNode;

  // Add the standard bootstrap code to the page.

  // Get the base URL from the window's URL by dropping `/debug` and everything
  // after (e.g. `/debug/edit/...`). This is brittle, in that it bakes in a bit
  // of specific knowledge about the endpoint path.
  const windowUrl = window.location.href;
  const baseUrl   = windowUrl.replace(/[/]debug[/].*$/, '');

  const elem = document.createElement('script');
  elem.src = `${baseUrl}/boot-from-info.js`;
  document.head.appendChild(elem);
});
