// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ServerEnv } from '@bayou/env-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { UtilityClass } from '@bayou/util-common';

/** {Logger} Logger for this file. */
const log = new Logger('art-fail');

/**
 * Utility class with the top-level implementations of some of the possible
 * artificial failures.
 *
 * **Note:** As of this writing, this file has _all_ the artificial failure
 * implementations, but in the long run that will probably stop being true.
 */
export class ArtificialFailure extends UtilityClass {
  /**
   * Start behaving badly per the configiured failure mode, if any. If either
   * (a) no failure is to happen on this server, or (b) this class doesn't
   * handle the failure mode in question, then this method is a no-op (no
   * action, no error); this is done so that it's possible to call this method
   * unconditionally during system startup.
   */
  static startFailingIfAppropriate() {
    const failInfo = ServerEnv.theOne.artificialFailureInfo;

    if (failInfo.shouldFail()) {
      const failType   = failInfo.failType;
      const failMethod = ArtificialFailure[`fail_${failType}`];
      if (failMethod !== undefined) {
        log.event.topLevelArtificialFailure(failType);
        failMethod.call(ArtificialFailure);
      }
    }
  }

  /**
   * Start behaving badly per the `justLogging` failure mode.
   */
  static fail_justLogging() {
    const bootInfo = ServerEnv.theOne.bootInfo;

    (async () => {
      let count = 0;

      for (;;) {
        // One spate of logging every ten seconds.
        await Delay.resolve(10 * 1000);

        count++;
        log.event.artificialFailure(count);
        bootInfo.logArtificialFailure(count);
      }
    })();
  }
}
