// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor.
 */

import Quill from 'quill';
import ApiClient from './ApiClient';

// Initialize the API connection.
var api = new ApiClient(document.URL);
api.open();

const toolbarOptions = [
  ['bold', 'italic', 'underline', 'strike', 'code'],// toggled buttons
  ['blockquote', 'code-block'],

  [{ 'header': 1 }, { 'header': 2 }],               // custom button values
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
  [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent

  [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

  [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
  [{ 'font': [] }],
  [{ 'align': [] }],

  ['clean']                                         // remove formatting button
];

var quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: toolbarOptions
  }
});

// Get Quill to report deltas to the server.
quill.on('text-change', (delta, oldDelta, source) => {
  if (source !== 'user') {
    return;
  }
  api.update(delta);
});

// Get the initial document state from the server.
api.snapshot().then(
  (result) => {
    quill.setContents(result, 'api');
  },
  (error) => {
    throw new Error(error);
  }
);

// Demonstrates that Webpack conversion and bundling is working as expected.
import TypescriptDemo from './TypescriptDemo';
import EcmaDemo from './EcmaDemo';
console.log('ES2017: ' + EcmaDemo.square(20));
console.log('TypeScript: ' + TypescriptDemo.triple(5));
