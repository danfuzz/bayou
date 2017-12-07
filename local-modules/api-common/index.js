// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';

import BaseKey from './BaseKey';
import CodableError from './CodableError';
import ConnectionError from './ConnectionError';
import Message from './Message';
import Response from './Response';
import SplitKey from './SplitKey';

// Register classes for encoding / decoding.
Codec.theOne.registerClass(CodableError);
Codec.theOne.registerClass(Message);
Codec.theOne.registerClass(Response);
Codec.theOne.registerClass(SplitKey);

export { BaseKey, CodableError, ConnectionError, Message, Response, SplitKey };
