// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import AuthorId from './AuthorId';
import BaseChange from './BaseChange';
import BaseSnapshot from './BaseSnapshot';
import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';
import BodySnapshot from './BodySnapshot';
import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import CaretSnapshot from './CaretSnapshot';
import DocumentId from './DocumentId';
import PropertyChange from './PropertyChange';
import PropertyDelta from './PropertyDelta';
import PropertyOp from './PropertyOp';
import PropertySnapshot from './PropertySnapshot';
import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

// Register classes with the API.
Codec.theOne.registerClass(BodyChange);
Codec.theOne.registerClass(BodyDelta);
Codec.theOne.registerClass(BodySnapshot);
Codec.theOne.registerClass(Caret);
Codec.theOne.registerClass(CaretChange);
Codec.theOne.registerClass(CaretDelta);
Codec.theOne.registerClass(CaretOp);
Codec.theOne.registerClass(CaretSnapshot);
Codec.theOne.registerClass(PropertyChange);
Codec.theOne.registerClass(PropertyDelta);
Codec.theOne.registerClass(PropertyOp);
Codec.theOne.registerClass(PropertySnapshot);
Codec.theOne.registerClass(Timestamp);

export {
  AuthorId,
  BaseChange,
  BaseSnapshot,
  BodyChange,
  BodyDelta,
  BodySnapshot,
  Caret,
  CaretChange,
  CaretDelta,
  CaretOp,
  CaretSnapshot,
  DocumentId,
  PropertyChange,
  PropertyDelta,
  PropertyOp,
  PropertySnapshot,
  Timestamp,
  RevisionNumber
};
