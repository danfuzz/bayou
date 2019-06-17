// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import crypto from 'crypto';
import { camelCase } from 'lodash';

import { Deployment } from '@bayou/config-server';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
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

    /**
     * {boolean} Whether failure is actually allowed. If `false`, then this
     * instance reports that failure shouldn't actually happen.
     */
    this._allowFailure = false;

    /** {Int} Percentage of servers which should experience a failure. */
    this._failPercent = failPercent;

    /** {string} Type of failure to induce. */
    this._failType = failType;

    Object.seal(this);

    if (this._failPercent !== 0) {
      log.event.artificialFailureParameters(this._failPercent, this._failType);
      log.info('#####');
      log.info('#####');
      log.info('##### NOTE: This build is configured with artificial failure!');
      log.info('#####');
      log.info('#####');
    }
  }

  /** {Int} Percentage of servers which should experience a failure. */
  get failPercent() {
    return this._allowFailure ? this._failPercent : 0;
  }

  /** {string} Type of failure to induce. */
  get failType() {
    return this._allowFailure ? this._failType : ArtificialFailureInfo.TYPE_none;
  }

  /**
   * {Int} _Nascent_ failure percentage. This is what {@link #failPercent} would
   * report if {@link #allowFailure} were called. This can be used to help
   * clients of this class decide whether or not to "pull the trigger" on
   * failure.
   */
  get nascentFailPercent() {
    return this._failPercent;
  }

  /**
   * Indicate that failure is actually allowed. If this call is never made, then
   * it is as if the build was not configured with any failures.
   */
  allowFailure() {
    if (this._allowFailure || (this._failPercent === 0)) {
      return;
    }

    log.event.artificialFailureEnabled();
    log.info('#####');
    log.info('#####');
    log.info('##### NOTE: Artificial failure is now enabled!');
    log.info('#####');
    log.info('#####');

    this._allowFailure = true;
  }

  /**
   * Indicates whether this server should actually be failing at all, or failing
   * specifically with the indicated type of failure. This will be `true` _if
   * and only if_ all of:
   *
   * * {@link #allowFailure} was called.
   * * {@link #failType} is the one passed here or is `null`.
   * * This server's hash causes it to be in the failing cohort per the
   *   {@link #failPercent}.
   *
   * @param {string|null} [failType = null] Type of failure in question, or
   *   `null` to just ask if this server should be faily in general. If
   *   non-`null`, must be one of the `TYPE_*` constants defined by this class.
   * @returns {boolean} `true` if this server should be failing in the indicated
   *   manner, or `false` if not.
   */
  shouldFail(failType = null) {
    TString.orNull(failType);

    const percent     = this.failPercent; // This will be `0` if `allowFailure()` wasn't called.
    const typeMatches = (failType === null) || (failType === this.failType);

    if ((percent === 0) || !typeMatches) {
      return false;
    }

    // Hash the server ID and convert it into a value in the range 0..99.
    const serverNum = ArtificialFailureInfo._percentFromString(Deployment.serverId());

    return serverNum < percent;
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
        || (typeConst !== camelType)) {
      // Fail-safe: If the build info properties aren't set up right, treat it
      // as a no-failure situation.
      return [0, ArtificialFailureInfo.TYPE_none];
    }

    return [percentNum, typeConst];
  }

  /**
   * Gets an integer value in the range `[0..99]` as the hash of a given string.
   *
   * @param {string} s The string to hash.
   * @returns {Int} The hashed value.
   */
  static _percentFromString(s) {
    TString.check(s);

    const hash = crypto.createHash('sha256');

    hash.update(s);

    const digest = hash.digest();
    const value  = digest.readUInt32LE(); // Grab first 32 bits as the base hash.
    const frac   = value / 0x100000000;

    return Math.floor(frac * 100);
  }
}
