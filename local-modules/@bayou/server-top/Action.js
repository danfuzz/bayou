// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase, kebabCase } from 'lodash';

import { CommonBase } from '@bayou/util-common';

import Options from './Options';

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
   */
  run() {
    const methodName = `_run_${camelCase(this._options.action)}`;
    this[methodName]();
  }

  /**
   * Performs the action `client-bundle`.
   */
  _run_clientBundle() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `client-test`.
   */
  _run_clientTest() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `dev`.
   */
  _run_dev() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `dev-if-appropriate`.
   */
  _run_devIfAppropriate() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `help`.
   */
  _run_help() {
    this._options.usage();
  }

  /**
   * Performs the action `production`.
   */
  _run_production() {
    throw new Error('TODO');
  }

  /**
   * Performs the action `server-test`.
   */
  _run_serverTest() {
    throw new Error('TODO');
  }
}
