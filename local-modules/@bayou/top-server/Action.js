// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase, kebabCase } from 'lodash';
import path from 'path';

import { Application, Monitor } from '@bayou/app-setup';
import { ClientBundle } from '@bayou/client-bundle';
import { Deployment, Network } from '@bayou/config-server';
import { DevMode } from '@bayou/dev-mode';
import { Dirs, ProductInfo, ServerEnv } from '@bayou/env-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { HumanSink, FileSink } from '@bayou/see-all-server';
import { ClientTests, ServerTests } from '@bayou/testing-server';
import { CommonBase } from '@bayou/util-common';

import Options from './Options';

/** {Logger} Logger for this file. */
const log = new Logger('top-action');

/**
 * Top-level server actions. See {@link Options#usage} for semantic details.
 */
export default class Action extends CommonBase {
  /** {array<string>} Array of all allowed actions, in kebab-case form. */
  static get ACTIONS() {
    if (!this._actions) {
      const actions = [];

      for (const name of Object.getOwnPropertyNames(Action.prototype)) {
        const match = name.match(/^_run_(.*)$/);
        if (match !== null) {
          actions.push(kebabCase(match[1]));
        }
      }

      this._actions = actions;
    }

    return this._actions;
  }

  /**
   * Constructs an instance.
   *
   * @param {Options} options Parsed command-line options.
   */
  constructor(options) {
    super();

    /** {Options} Parsed command-line options. */
    this._options = Options.check(options);

    Object.freeze(this);
  }

  /** {string} The action name. */
  get name() {
    return this._options.action;
  }

  /**
   * Indicates whether or not this is a full server run, as opposed to one of
   * the more ephemeral actions (such as a unit test run).
   *
   * @returns {boolean} `true` iff this action actually starts a server running
   *   on an ongoing basis.
   */
  isFullRun() {
    switch (this.name) {
      case 'dev':
      case 'dev-if-appropriate':
      case 'production': {
        return true;
      }

      default: {
        return false;
      }
    }
  }

  /**
   * Performs the action indicated by the `options` of this instance.
   *
   * @returns {Int|null} Process exit code as returned by the action
   *   implementation, or `null` to indicate that the process should not exit
   *   once the immediate action is complete.
   */
  async run() {
    const methodName = `_run_${camelCase(this.name)}`;

    this._startLogging();

    // Give the outer app a chance to do any required early initialization.
    await Deployment.aboutToRun(this);

    return this[methodName]();
  }

  /**
   * Performs the action `client-bundle`.
   *
   * @returns {Int} Standard process exit code.
   */
  async _run_clientBundle() {
    try {
      await new ClientBundle().build();
      log.info('');
      log.info('Built client bundles. No errors!');
      return 0;
    } catch (e) {
      log.error(e);
      return 1;
    }
  }

  /**
   * Performs the action `client-test`.
   *
   * @returns {Int} Standard process exit code.
   */
  async _run_clientTest() {
    // Figure out if there is already a server listening on the designated
    // application port. If not, run one locally in this process.

    const alreadyRunning = await ServerEnv.theOne.isAlreadyRunningLocally();
    let port;

    if (alreadyRunning) {
      port = Network.listenPort;
      log.info(
        'NOTE: There is a server already running on this machine. The client test run\n' +
        '      will issue requests to it instead of trying to build a new test bundle.');
    } else {
      // Start up a server in this process, since we determined that this
      // machine isn't already running one. We tell it to pick a free port
      // (instead of assuming the usual one is available; it likely won't be if
      // the tests are running on a shared machine) and will make the `/debug`
      // endpoints available.
      port = await Action._startServer(true, false, true);

      // Wait a few seconds, so that we can be reasonably sure that the request
      // handlers are ready to handle requests. And there's no point in issuing
      // a request until the test code bundle is built, anyway; that takes at
      // least this long (probably longer).
      await Delay.resolve(15 * 1000);
    }

    const anyFailed =
      await ClientTests.run(port, this._options.testOut, this._options.testFilter);

    return anyFailed ? 1 : 0;
  }

  /**
   * Performs the action `dev`.
   *
   * @returns {Int|null} `null` on successful start, or standard process exit
   *   code on failure.
   */
  async _run_dev() {
    await Action._startServer(false, true, true);

    log.event.runningConfiguration('dev');

    // Start the system that live-syncs the client source and arranges to exit
    // if / when the server needs to be rebuilt.
    await DevMode.theOne.start();

    return null;
  }

  /**
   * Performs the action `dev-if-appropriate`.
   *
   * @returns {Int|null} `null` on successful start, or standard process exit
   *   code on failure.
   */
  async _run_devIfAppropriate() {
    if (Deployment.isRunningInDevelopment()) {
      return this._run_dev();
    } else {
      return this._run_production();
    }
  }

  /**
   * Performs the action `help`.
   */
  async _run_help() {
    this._options.usage();
  }

  /**
   * Performs the action `production`.
   *
   * @returns {Int|null} `null` on successful start, or standard process exit
   *   code on failure.
   */
  async _run_production() {
    await Action._startServer(false, true, false);

    log.event.runningConfiguration('production');
    return null;
  }

  /**
   * Performs the action `server-test`.
   *
   * @returns {Int} Standard process exit code.
   */
  async _run_serverTest() {
    const anyFailed =
      await ServerTests.run(this._options.testOut, this._options.testFilter);

    return anyFailed ? 1 : 0;
  }

  /**
   * Set up logging as appropriate for this instance.
   */
  _startLogging() {
    if (this.isFullRun()) {
      const humanConsole = this._options.humanConsole;
      const humanLogFile = path.resolve(Dirs.theOne.LOG_DIR, 'general.txt');
      const jsonLogFile  = path.resolve(Dirs.theOne.LOG_DIR, 'general.json');

      // Second argument to both of these constructors is a boolean `useConsole`
      // which indicates (when `true`) that the sink in question should also
      // write to the console.
      new FileSink(jsonLogFile, !humanConsole);
      new HumanSink(humanLogFile, humanConsole);

      HumanSink.patchConsole();
    } else {
      new HumanSink(null, true);
    }
  }

  /**
   * Helper for actions which need to start a server, which in fact does the
   * bulk of the work.
   *
   * @param {boolean} pickPort Whether or not to pick an arbitrary main server
   *   port. When `false`, uses the configured application port.
   * @param {boolean} doMonitor Whether or not to enable the system monitor
   *   endpoints.
   * @param {boolean} devRoutes Whether or not to enable the development mode
   *   endpoints (e.g., `/debug/log`).
   * @returns {Int} The port being listened on, once listening has started.
   */
  static async _startServer(pickPort, doMonitor, devRoutes) {
    // Set up the server environment bits (including, e.g. the PID file).
    await ServerEnv.theOne.init();

    // A little spew to identify the build and our environment.

    log.metric.boot();
    log.event.buildInfo(ProductInfo.theOne.INFO);
    log.event.runtimeInfo(ServerEnv.theOne.runtimeInfo);
    log.event.bootInfo(ServerEnv.theOne.bootInfo);

    /** {Application} The main app server. */
    const theApp = new Application(devRoutes);

    // Start the app! The result is the port that it ends up listening on.
    const result = theApp.start(pickPort);

    if (doMonitor) {
      const monitorPort = Network.monitorPort;
      if (monitorPort !== null) {
        try {
          const monitor = new Monitor(theApp, monitorPort);
          await monitor.start();
        } catch (e) {
          // Log the error, but soldier on.
          log.error('Could not start monitor server!', e);
        }
      }
    }

    return result;
  }
}
