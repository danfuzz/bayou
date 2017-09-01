// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import AuthorId from './AuthorId';
import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';
import DocumentSnapshot from './DocumentSnapshot';
import Caret from './Caret';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import CaretSnapshot from './CaretSnapshot';
import DocumentId from './DocumentId';
import FrozenDelta from './FrozenDelta';
import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

// Register classes with the API.
Codec.theOne.registerClass(BodyChange);
Codec.theOne.registerClass(BodyDelta);
Codec.theOne.registerClass(DocumentSnapshot);
Codec.theOne.registerClass(Caret);
Codec.theOne.registerClass(CaretDelta);
Codec.theOne.registerClass(CaretOp);
Codec.theOne.registerClass(CaretSnapshot);
Codec.theOne.registerClass(FrozenDelta);
Codec.theOne.registerClass(Timestamp);

export {
  AuthorId,
  BodyChange,
  BodyDelta,
  DocumentSnapshot,
  Caret,
  CaretDelta,
  CaretOp,
  CaretSnapshot,
  DocumentId,
  FrozenDelta,
  Timestamp,
  RevisionNumber
};
