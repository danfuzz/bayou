// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseKey from './BaseKey';
import Decoder from './Decoder';
import Encoder from './Encoder';
import Message from './Message';
import Registry from './Registry';
import SplitKey from './SplitKey';

// Register classes with the API.
Registry.register(Message);
Registry.register(SplitKey);

// TODO: Export `BearerToken`. Right now, doing so causes a dependency loop
// between this module and `hooks-server`, which will need to get untangled
// first.

export { BaseKey, /*BearerToken,*/ Decoder, Encoder, Message, Registry, SplitKey };
