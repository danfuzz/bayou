// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TInt, TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * {Int} Maximum number of unique IP addresses to ever include in a logged item.
 * (More than that will just get reported as a number.)
 */
const MAX_UNIQUE_IPS_PER_LOG = 20;

/**
 * {Int} Aggregation interval, in msec. The system will only log an event for
 * any given aggregated path this often.
 */
const AGGREGATION_INTERVAL_MSEC = 60 * 1000; // Once per minute.

/**
 * Mutable holder for aggregated log data for requests to a particular path.
 */
export class RequestAggregateData extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} path Path which this instance is all about.
   * @param {Logger} log Logger to use.
   */
  constructor(path, log) {
    super();

    /** {String} path Path which this instance is all about. */
    this._path = TString.nonEmpty(path);

    /** {Logger} Logger to use. */
    this._log = Logger.check(log);

    /**
     * {Map<string, object>} Map from source IP addresses to an ad-hoc object
     * which maps status codes to counts of requests.
     */
    this._ipMap = new Map();

    /** {boolean} Whether there is an aggregation timer currently running. */
    this._timerRunning = false;

    Object.seal(this);
  }

  /**
   * Indicates that a request was made to this path.
   *
   * @param {string} sourceIp Source IP address of the request.
   * @param {Int} status Result status code.
   */
  requestMade(sourceIp, status) {
    TString.nonEmpty(sourceIp);
    TInt.nonNegative(status);

    const statusCounts = this._getStatusArray(sourceIp);
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (!this._timerRunning) {
      // There's no aggregation timer already running. Set it up, so that we
      // will issue an event log after the appropriate interval.
      this._timerRunning = true;
      (async () => {
        await Delay.resolve(AGGREGATION_INTERVAL_MSEC);
        this._timerRunning = false;
        this._logAndReset();
      })();
    }
  }

  /**
   * Gets the sparse array from status code to count, for the given source IP
   * address. This creates and binds the array into {@link #_ipMap} if it isn't
   * already bound.
   *
   * @param {string} sourceIp Source IP address.
   * @returns {array} Corresponding array.
   */
  _getStatusArray(sourceIp) {
    const already = this._ipMap.get(sourceIp);

    if (already !== undefined) {
      return already;
    }

    const result = {};

    this._ipMap.set(sourceIp, result);
    return result;
  }

  /**
   * Writes out all the aggregated information held by this instance, and resets
   * the instance for further aggregation.
   */
  _logAndReset() {
    let   totalRequests = 0;
    const statusCounts  = {};
    const allIps        = new Set();

    for (const [ip, counts] of this._ipMap) {
      allIps.add(ip);
      for (const [status, count] of Object.entries(counts)) {
        totalRequests += count;
        statusCounts[status] = (statusCounts[status] || 0) + count;
      }
    }

    const ips = RequestAggregateData._ipsForLogging(allIps);
    this._log.event.httpAggregate(this._path, { totalRequests, statusCounts, ips });

    this._ipMap.clear();
  }

  /**
   * Gets the logging form for the given set of IP addresses.
   *
   * @param {Set} ips Set of IP addresses.
   * @returns {*} Logging form for same.
   */
  static _ipsForLogging(ips) {
    return (ips.size <= MAX_UNIQUE_IPS_PER_LOG)
      ? [...ips]
      : `${ips.size} unique addresses`;
  }
}
