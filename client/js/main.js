// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. It expects
 * there to be a DOM node tagged with id `editor`.
 */

import { ApiClient } from 'api-client';
import { Decoder } from 'api-common';
import { DocClient } from 'doc-client';
import { Hooks } from 'hooks-client';
import { QuillMaker } from 'quill-util';
import { SeeAllBrowser } from 'see-all-browser';

// Init logging.
SeeAllBrowser.init();

// Figure out what node we're attaching the editor to. We use the `BAYOU_NODE`
// global specified by the enclosing HTML, if passed, or default to `#editor`.
// TODO: Should probably just insist on `BAYOU_NODE` being defined.
const editorNode = window.BAYOU_NODE || '#editor';
if (document.querySelector(editorNode) === null) {
  const extra = (editorNode[0] === '#') ? '' : ' (maybe need a `#` prefix?)';
  throw new Error(`No such selector${extra}: \`${editorNode}\``);
}

// Figure out the URL of our server. We use the `BAYOU_KEY` global specified by
// the enclosing HTML, if passed, or default to using the document's URL. We
// don't just _always_ use the document's URL because it is possible to embed
// an editor on a page that has a different origin than the server.
//
// **Note:** Under normal circumstances, the key we receive comes with a real
// URL. However, when using the debugging routes, it's possible that we end up
// with the catchall "URL" `*`. If so, we detect that here and fall back to
// using the document's URL.
const key = window.BAYOU_KEY
  ? Decoder.decodeJson(window.BAYOU_KEY)
  : null;
const url = (key && (key.url !== '*')) ? key.url : document.URL;

// Cut off after the host name. Putting the main expression in a `?` group
// guarantees that the regex will match at least the empty string, which makes
// the subsequent logic a little nicer.
const baseUrl = url.match(/^([a-z]+:\/\/[^\/]+)?/)[0];
if (baseUrl.length === 0) {
  throw new Error(`Could not determine base URL of: ${url}`);
}

// Give the overlay a chance to do any initialization.
Hooks.run(window, baseUrl);

// Make the editor instance.
const quill = QuillMaker.make(editorNode);

// Initialize the API connection, and hook it up to the Quill instance. Similar
// to the node identification (immediately above), we use the URL inside the
// `BAYOU_KEY`, if that's passed, falling back on the document URL for the
// soon-to-be legacy case. TODO: Should probably insist on `BAYOU_KEY` being
// defined.

const apiClient = new ApiClient(baseUrl);
apiClient.open();
const docClient = new DocClient(quill, apiClient);
docClient.start();
