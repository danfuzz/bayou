// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import TheModule from './TheModule';
import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';
import BodyOp from './BodyOp';
import BodySnapshot from './BodySnapshot';
import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import CaretSnapshot from './CaretSnapshot';
import DocumentId from './DocumentId';
import Property from './Property';
import PropertyChange from './PropertyChange';
import PropertyDelta from './PropertyDelta';
import PropertyOp from './PropertyOp';
import PropertySnapshot from './PropertySnapshot';
import Timeouts from './Timeouts';

// Register with the (senescent) singleton Codec. **TODO:** Remove this.
TheModule.registerCodecs(Codec.theOne.registry);

export {
  TheModule,
  BodyChange,
  BodyDelta,
  BodyOp,
  BodySnapshot,
  Caret,
  CaretChange,
  CaretDelta,
  CaretOp,
  CaretSnapshot,
  DocumentId,
  Property,
  PropertyChange,
  PropertyDelta,
  PropertyOp,
  PropertySnapshot,
  Timeouts
};
