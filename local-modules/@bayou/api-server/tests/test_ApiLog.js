// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Message } from '@bayou/api-common';
import { BearerToken } from '@bayou/api-server';
import { MockLogger } from '@bayou/see-all/mocks';
import { Functor } from '@bayou/util-common';

// Not an exported class, so we have to import it as a file.
import ApiLog from '../ApiLog';

describe('@bayou/api-server/ApiLog', () => {
  describe('incomingMessage()', () => {
    it('should log the redacted form of target when the target is a token', () => {
      const logger = new MockLogger();
      const apiLog = new ApiLog(logger);
      const token  = new BearerToken('the-id', 'the-secret-token');
      const msg    = new Message(123, token, new Functor('x', 'y'));

      apiLog.incomingMessage(msg);

      const record = logger.record;

      assert.length(record, 1);

      const item = record[0];

      console.log('=======', item);
    });
  });
});
