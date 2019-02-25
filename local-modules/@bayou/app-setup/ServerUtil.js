// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ServerEnv } from '@bayou/env-server';
import { Logger } from '@bayou/see-all';
import { UtilityClass } from '@bayou/util-common';

/** {Logger} Logger for this class. */
const log = new Logger('app');

/**
 * Utility functions for dealing with `Server`s (e.g., HTTP server objects and
 * the like).
 */
export default class ServerUtil extends UtilityClass {
  /**
   * Arranges for the given `Server` to stop listening for connections when
   * the system is trying to shut down.
   *
   * @param {Server} server `Server` to manage.
   */
  static async handleSystemShutdown(server) {
    const shutdownManager = ServerEnv.theOne.shutdownManager;
    const address = server.address(); // For logging.

    // Promise that resolves when the server gets closed. We need this so it can
    // race with the shutdown condition and, when shutdown is in progress, so
    // the shutdown manager can wait for it. **Note:** The `close` event is only
    // supposed to be emitted once there are no more active connections on the
    // server's socket.
    const closePromise = new Promise((resolve) => {
      server.on('close', () => {
        log.event.serverClosed(address);
        resolve(true);
      });
    });

    await Promise.race([closePromise, shutdownManager.whenShuttingDown()]);

    // Only bother with further action if the server socket is still open.
    if (server.listening) {
      log.event.serverShutdown(address);
      shutdownManager.waitFor(closePromise);
      server.close();
    }
  }

  /**
   * Issues a `listen()` to a `Server` instance, converting the subsequent
   * events to a promise.
   *
   * **Note:** This method exists because the standard `Server.listen()` as
   * defined and implemented by the Node library doesn't actually use its
   * callback argument in the Node-standard way. Specifically, it won't report
   * errors through that callback.
   *
   * @param {Server} server `Server` to tell to `listen()`.
   * @param {Int} port Port to listen on, or `0` to have the system pick an
   *   available port.
   * @returns {Int} The port actually being listened on.
   * @throws {Error} Whatever shows up in an `error` event caused by the
   *   attempt, if that event gets emitted.
   */
  static async listen(server, port) {
    await new Promise((resolve, reject) => {
      function done(err) {
        server.removeListener('listening', handleListening);
        server.removeListener('error',     handleError);

        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      }

      function handleListening() {
        done(null);
      }

      function handleError(err) {
        done(err);
      }

      server.on('listening', handleListening);
      server.on('error',     handleError);
      server.listen(port);
    });

    return server.address().port;
  }
}
