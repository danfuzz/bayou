// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import AuthorId from './AuthorId';
import BaseChange from './BaseChange';
import BaseDelta from './BaseDelta';
import BaseOp from './BaseOp';
import BaseSnapshot from './BaseSnapshot';
import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

// Register classes with the API.
Codec.theOne.registerClass(Timestamp);

export {
  AuthorId,
  BaseChange,
  BaseDelta,
  BaseOp,
  BaseSnapshot,
  Timestamp,
  RevisionNumber
};
