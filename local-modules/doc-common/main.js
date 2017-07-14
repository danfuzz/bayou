// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';

import AuthorId from './AuthorId';
import Caret from './Caret';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import CaretSnapshot from './CaretSnapshot';
import DocumentDelta from './DocumentDelta';
import DocumentChange from './DocumentChange';
import DocumentId from './DocumentId';
import DocumentSnapshot from './DocumentSnapshot';
import FrozenDelta from './FrozenDelta';
import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

// Register classes with the API.
Codec.theOne.registerClass(Caret);
Codec.theOne.registerClass(CaretDelta);
Codec.theOne.registerClass(CaretOp);
Codec.theOne.registerClass(CaretSnapshot);
Codec.theOne.registerClass(DocumentDelta);
Codec.theOne.registerClass(DocumentChange);
Codec.theOne.registerClass(DocumentSnapshot);
Codec.theOne.registerClass(FrozenDelta);
Codec.theOne.registerClass(Timestamp);

export {
  AuthorId,
  Caret,
  CaretDelta,
  CaretOp,
  CaretSnapshot,
  DocumentDelta,
  DocumentChange,
  DocumentId,
  DocumentSnapshot,
  FrozenDelta,
  Timestamp,
  RevisionNumber
};
