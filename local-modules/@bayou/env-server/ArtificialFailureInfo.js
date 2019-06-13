// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { camelCase } from 'lodash';

import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

import { BuildInfo } from './BuildInfo';

/** {Logger} Logger for this module. */
const log = new Logger('art-fail');

/**
 * Information about the how this server should intentionally fail.
 */
export class ArtificialFailureInfo extends CommonBase {
  /**
   * {string} Type indicating that "failure" should just be in the form of logs
   * that look "faily" without any other change in behavior.
   */
  static get TYPE_justLogging() { return 'justLogging'; }

  /** {string} Type indicating no actual failure at all. */
  static get TYPE_none() { return 'none'; }

  /**
   * Constructs an instance.
   *
   * @param {BuildInfo} buildInfo The boot info, which includes artificial
   *   failure configuration.
   */
  constructor(buildInfo) {
    BuildInfo.check(buildInfo);

    super();

    const [failPercent, failType] = ArtificialFailureInfo._parseInfo(buildInfo);

    /** {Int} Percentage of servers which should experience a failure. */
    this._failPercent = failPercent;

    /** {string} Type of failure to induce. */
    this._failType = failType;

    Object.seal(this);

    if (this._failPercent !== 0) {
      log.event.artificialFailure(this._failPercent, this._failType);
      log.info('#####');
      log.info('#####');
      log.info('##### NOTE: This build is configured with artificial failure!');
      log.info('#####');
      log.info('#####');
    }
  }

  /** {Int} Percentage of servers which should experience a failure. */
  get failPercent() {
    return this._failPercent;
  }

  /** {string} Type of failure to induce. */
  get failType() {
    return this._failType;
  }

  /**
   * Change this instance to indicate that failure should not occur. This is
   * meant to be used at startup time as a final backstop around intentional
   * failure. For example, it can be used in unit test code paths to prevent
   * artificial failures from becoming unit test failures, and it can prevent
   * production configurations from veering into unsafe territory.
   */
  doNotFail() {
    this._failPercent = 0;
    this._failType    = ArtificialFailureInfo.TYPE_none;
  }

  /**
   * Parses the failure info out of a boot info object.
   *
   * @param {BootInfo} buildInfo The boot info.
   * @returns {array} Failure info consisting of `[failPercent, failType]`.
   */
  static _parseInfo(buildInfo) {
    BuildInfo.check(buildInfo);

    const { artificialFailurePercent, artificialFailureType } = buildInfo.info;

    const percentNum = parseInt(artificialFailurePercent);
    const camelType  = camelCase(artificialFailureType || '<bogus>');
    const typeConst  = ArtificialFailureInfo[`TYPE_${camelType}`];

    if (   isNaN(percentNum) || (percentNum < 0) || (percentNum > 100)
        || (typeConst !== artificialFailureType)) {
      // Fail-safe: If the build info properties aren't set up right, treat it
      // as a no-failure situation.
      return [0, ArtificialFailureInfo.TYPE_none];
    }

    return [percentNum, typeConst];
  }
}
