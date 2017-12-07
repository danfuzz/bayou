// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import MockChange from './MockChange';
import MockDelta from './MockDelta';
import MockOp from './MockOp';
import MockSnapshot from './MockSnapshot';

// Register classes with the API.
Codec.theOne.registerClass(MockChange);
Codec.theOne.registerClass(MockDelta);
Codec.theOne.registerClass(MockOp);
Codec.theOne.registerClass(MockSnapshot);

export {
  MockChange,
  MockDelta,
  MockOp,
  MockSnapshot
};
