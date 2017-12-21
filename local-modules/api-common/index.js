// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import TheModule from './TheModule';
import BaseKey from './BaseKey';
import CodableError from './CodableError';
import ConnectionError from './ConnectionError';
import Message from './Message';
import Response from './Response';
import SplitKey from './SplitKey';
import TargetId from './TargetId';

// Register with the (senescent) singleton Codec. **TODO:** Remove this.
TheModule.registerCodecs(Codec.theOne.registry);

export {
  TheModule,
  BaseKey,
  CodableError,
  ConnectionError,
  Message,
  Response,
  SplitKey,
  TargetId
};
