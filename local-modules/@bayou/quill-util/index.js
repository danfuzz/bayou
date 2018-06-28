// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BayouKeyboard from './BayouKeyboard';
import NotReallyMarkdown from './NotReallyMarkdown';
import QuillEvents from './QuillEvents';
import QuillGeometry from './QuillGeometry';
import QuillProm from './QuillProm';
import QuillUtil from './QuillUtil';

// Register this module's keyboard handler as an override of Quill's built-in
// one.
QuillProm.register({
  'modules/keyboard': BayouKeyboard
}, true);


export {
  BayouKeyboard,
  NotReallyMarkdown,
  QuillEvents,
  QuillGeometry,
  QuillProm,
  QuillUtil,
};
