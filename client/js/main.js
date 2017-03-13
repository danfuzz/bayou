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

// Give the overlay a chance to do any initialization.
Hooks.run();

// Make the instance. We use the `BAYOU_NODE` specified by the enclosing HTML,
// if passed, or default to `#editor`. TODO: Should probably just insist on
// `BAYOU_NODE` being defined.

const quill = QuillMaker.make(window.BAYOU_NODE || '#editor');

// Initialize the API connection, and hook it up to the Quill instance. Similar
// to the node identification (immediately above), we use the URL inside the
// `BAYOU_KEY`, if that's passed, falling back on the document URL for the
// soon-to-be legacy case. TODO: Should probably insist on `BAYOU_KEY` being
// defined.

const key = window.BAYOU_KEY
  ? Decoder.decodeJson(window.BAYOU_KEY)
  : null;
const url = key ? key.url : document.URL;

const apiClient = new ApiClient(url);
apiClient.open();
const docClient = new DocClient(quill, apiClient);
docClient.start();
