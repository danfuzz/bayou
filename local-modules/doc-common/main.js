// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import ApiCommon from 'api-common';

import DeltaUtil from './DeltaUtil';
import DocumentChange from './DocumentChange';
import FrozenDelta from './FrozenDelta';
import Snapshot from './Snapshot';

// Register classes with the API.
ApiCommon.registerClass(DocumentChange);
ApiCommon.registerClass(FrozenDelta);
ApiCommon.registerClass(Snapshot);

export { DeltaUtil, DocumentChange, FrozenDelta, Snapshot };
