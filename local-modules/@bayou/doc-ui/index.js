// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { QuillProm } from '@bayou/quill-util';

import BayouKeyboard from './BayouKeyboard';
import CaretState from './CaretState';
import EditorComplex from './EditorComplex';

// Register this module's keyboard handler as an override of Quill's built-in
// one.
QuillProm.register({
  'modules/keyboard': BayouKeyboard
}, true);

export { CaretState, EditorComplex };
