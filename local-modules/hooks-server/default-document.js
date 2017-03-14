// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Default (initial) contents of documents.
 */
export default [
  { insert: 'Welcome to Bayou!' },
  { insert: '\n', attributes: { header: 1 } },
  { insert: 'Now go grab a ' },
  { insert: 'boat', attributes: { bold: true } },
  { insert: ' and start ' },
  { insert: 'a-rowin\'', attributes: { italic: true } },
  { insert: '.\n' }
];
