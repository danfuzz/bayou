// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase, kebabCase } from 'lodash';

import { ClientBundle } from '@bayou/client-bundle';
import { Logger } from '@bayou/see-all';
import { HumanSink } from '@bayou/see-all-server';
import { ServerTests } from '@bayou/testing-server';
import { CommonBase } from '@bayou/util-common';

import Options from './Options';

/** {Logger} Logger for this file. */
const log = new Logger('top-action');

/**
 * Top-level server actions. See {@link Options#usage} for semantic details.
 */
export default class Actions extends CommonBase {
  /** {array<string>} Array of all allowed actions, in kebab-case form. */
  static get ACTIONS() {
    if (!this._actions) {
      const actions = [];

      for (const name of Object.getOwnPropertyNames(Actions.prototype)) {
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

  /**
   * Performs the action indicated by the `options` of this instance.
   *
   * @returns {Int} Process exit code as returned by the action implementation.
   */
  async run() {
    const methodName = `_run_${camelCase(this._options.action)}`;
    const exitCode   = await this[methodName]();

    return exitCode || 0;
  }

  /**
   * Performs the action `client-bundle`.
   *
   * @returns {Int} Standard process exit code.
   */
  async _run_clientBundle() {
    new HumanSink(null, true);

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
   */
  async _run_clientTest() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `dev`.
   */
  async _run_dev() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `dev-if-appropriate`.
   */
  async _run_devIfAppropriate() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `help`.
   */
  async _run_help() {
    this._options.usage();
  }

  /**
   * Performs the action `production`.
   */
  async _run_production() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `server-test`.
   *
   * @returns {Int} Standard process exit code.
   */
  async _run_serverTest() {
    new HumanSink(null, true);

    const anyFailed = await ServerTests.run(this._options.testOut || null);

    return anyFailed ? 1 : 0;
  }
}
