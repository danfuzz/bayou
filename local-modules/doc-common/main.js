// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';

import AuthorId from './AuthorId';
import DeltaResult from './DeltaResult';
import DocumentChange from './DocumentChange';
import DocumentId from './DocumentId';
import FrozenDelta from './FrozenDelta';
import Snapshot from './Snapshot';
import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

// Register classes with the API.
Codec.theOne.registerClass(DeltaResult);
Codec.theOne.registerClass(DocumentChange);
Codec.theOne.registerClass(FrozenDelta);
Codec.theOne.registerClass(Snapshot);
Codec.theOne.registerClass(Timestamp);

export {
  AuthorId,
  DeltaResult,
  DocumentChange,
  DocumentId,
  FrozenDelta,
  Snapshot,
  Timestamp,
  RevisionNumber
};
