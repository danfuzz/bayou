// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the deployment configuration of a server.
 */
export class Deployment extends UtilityClass {
  /**
   * {array<string>} Array of absolute filesystem paths to the asset directory
   * trees, in priority order (earliest directory "overrides" later ones when
   * two or more contain the same-named file). All files under these directories
   * are expected to be servable to clients; that is, there should be no
   * server-private files under them.
   */
  static get ASSET_DIRS() {
    return use.Deployment.ASSET_DIRS;
  }

  /**
   * Performs any setup needed prior to running either a server per se or one
   * of the server actions (such as running a unit test). This gets called
   * _after_ the very lowest layer of the system is set up (e.g. the Babel
   * runtime) and _after_ the logging system is ready, and _before_ everything
   * else.
   *
   * @param {@bayou/top-server/Action} action The action that is about to be
   *   run.
   */
  static async aboutToRun(action) {
    await use.Deployment.aboutToRun(action);
  }

  /**
   * Determines the location of the "var" (variable / mutable data) directory,
   * returning an absolute path to it. (This is where, for example, log files
   * are stored.) The directory need not exist; the system will take care of
   * creating it as needed.
   *
   * The `baseDir` argument is provided for use by configurations (such as
   * commonly used during development) which want to keep code and data
   * together. It's expected that in many production environments, though, the
   * `baseDir` argument will be ignored, instead returning an unrelated
   * filesystem path. (For example, many deployment environments want to make
   * their code directories read-only.)
   *
   * @param {string} baseDir The base product directory. This is the root
   *   directory under which the code for the product lives.
   * @returns {string} Absolute filesystem path to the "var" directory to use.
   */
  static findVarDirectory(baseDir) {
    return use.Deployment.findVarDirectory(baseDir);
  }

  /**
   * Checks to see if this server is running in a "development" environment,
   * returning an indication of the fact. A development environment is notable
   * in that it notices when source files change (and acts accordingly), has
   * `/debug` endpoints enabled, and may be less secure in other ways as a
   * tradeoff for higher internal visibility, that is, higher debugability.
   *
   * @returns {boolean} `true` if this server is running in a development
   *   environment, or `false` if not.
   */
  static isRunningInDevelopment() {
    return use.Deployment.isRunningInDevelopment();
  }

  /**
   * Gets an object whose instance methods are to be provided via the API as
   * part of the root authority. The methods are provided in addition to what is
   * provided by default by {@link app-setup.RootAccess}. If no additional
   * methods are required by this configuration, this method should return
   * `null`.
   *
   * @returns {object|null} Object with additional methods to be provided as
   *   part of root access, or `null` if there are none.
   */
  static rootAccess() {
    return use.Deployment.rootAccess();
  }

  /**
   * Gets arbitrary server-identifying information, which gets returned to
   * clients via {@link MetaHandler#serverInfo}.
   *
   * @returns {object} Ad-hoc information about the server.
   */
  static serverInfo() {
    return use.Deployment.serverInfo();
  }

  /**
   * Checks to see if this server should serve code assets (most notably client
   * JavaScript bundles). It is typical (but not necessary) for this to be
   * `true` in development environments and `false` in production environments.
   *
   * @returns {boolean} `true` if this server should serve code assets, or
   *   `false` if not.
   */
  static shouldServeClientCode() {
    return use.Deployment.shouldServeClientCode();
  }
}
