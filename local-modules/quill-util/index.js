// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BayouKeyHandlers from './BayouKeyHandlers';
import BayouKeyboard from './BayouKeyboard';
import Macros from './Macros';
import NotReallyMarkdown from './NotReallyMarkdown';
import QuillEvents from './QuillEvents';
import QuillGeometry from './QuillGeometry';
import QuillProm from './QuillProm';
import QuillUtil from './QuillUtil';
import TextReplacement from './TextReplacement';

// Register this module's keyboard handler as an override of Quill's built-in
// one.
QuillProm.register({
  'modules/keyboard': BayouKeyboard
}, true);


export {
  BayouKeyHandlers,
  BayouKeyboard,
  Macros,
  NotReallyMarkdown,
  QuillEvents,
  QuillGeometry,
  QuillProm,
  QuillUtil,
  TextReplacement
};
