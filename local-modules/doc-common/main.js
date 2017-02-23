// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Registry } from 'api-common';

import DocumentChange from './DocumentChange';
import FrozenDelta from './FrozenDelta';
import Snapshot from './Snapshot';
import Timestamp from './Timestamp';
import VersionNumber from './VersionNumber';

// Register classes with the API.
Registry.register(DocumentChange);
Registry.register(FrozenDelta);
Registry.register(Snapshot);
Registry.register(Timestamp);

export {
  DocumentChange,
  FrozenDelta,
  Snapshot,
  Timestamp,
  VersionNumber
};
