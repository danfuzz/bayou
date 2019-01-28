// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken, Message } from '@bayou/api-common';
import { BaseTokenAuthorizer } from '@bayou/api-server';
import { MockLogger } from '@bayou/see-all/mocks';
import { Functor } from '@bayou/util-common';

// Not an exported class, so we have to import it as a file.
import ApiLog from '../ApiLog';

/**
 * Partial and simple implementation of {@link BaseTokenAuthorizer}. Only
 * includes what's required for testing.
 */
class MockTokenAuthorizer extends BaseTokenAuthorizer {
  isToken(string) {
    return /^token-/.test(string);
  }

  tokenFromString(string) {
    const match = string.match(/^token-(.*)$/);
    const id    = `id-${match[1]}`;

    return new BearerToken(id, string);
  }
}

describe('@bayou/api-server/ApiLog', () => {
  describe('incomingMessage()', () => {
    it('should log the redacted form of target when the target is a token', () => {
      const logger  = new MockLogger();
      const tokAuth = new MockTokenAuthorizer();
      const apiLog  = new ApiLog(logger, tokAuth);
      const token   = tokAuth.tokenFromString('token-123xyz');
      const msg     = new Message(123, token.secretToken, new Functor('x', 'y'));

      apiLog.incomingMessage(msg);

      const record = logger.record;

      assert.lengthOf(record, 1);

      // The event payload is always the third item in a mock-logged record.
      const payload = record[0][2];

      // The payload is of the form `apiReceived({ msg: ... })`, and we are
      // just going to be asserting on the `msg` part.
      assert.instanceOf(payload, Functor);
      const loggedMsg = payload.args[0].msg;

      // This should be the encoded form of a `Message`, which is itself a
      // three-argument functor, the second argument being the ID.
      assert.instanceOf(loggedMsg, Functor);
      const loggedId = loggedMsg.args[1];

      // The actual point of this unit test.
      assert.strictEqual(loggedId, `${token.id}-...`);
    });
  });
});
