// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from '@bayou/see-all';
import { TBoolean, TInt } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/** {Logger} Logger for this class. */
const log = new Logger('traffic');

/**
 * {Int} Time value which means "never," used to indicate when to allow traffic
 * if the system is "unhealthy" or shutting down.
 */
const NEVER_TIME_MSEC = Number.MAX_SAFE_INTEGER;

/**
 * {Int} Minimum amount of time (in msec) that the traffic signal must be `true`
 * for after transitioning from `false`, assuming that the server isn't either
 * unhealthy or in the process of shutting down.
 */
const MINIMUM_TRAFFIC_ALLOW_TIME_MSEC = 60 * 1000; // One minute.

/** {Int} Load factor above which duty-cycling begins. */
const MIN_LOAD_FACTOR_FOR_DUTY_CYCLE = 75;

/**
 * {Int} Load factor at-or-above which duty-cycling should have the maximum
 * allowed "off" time.
 */
const MAX_LOAD_FACTOR_FOR_DUTY_CYCLE = 150;

/**
 * {number} Fraction of time to prevent traffic, when doing minimal (but
 * active) duty cycling.
 */
const MIN_DUTY_CYCLE_OFF_TIME_FRAC = 0.1; // 10% of the time.

/**
 * {number} Fraction of time to prevent traffic, when doing maximal duty
 * cycling.
 */
const MAX_DUTY_CYCLE_OFF_TIME_FRAC = 0.5; // 50% of the time.

/**
 * Synthesizer of the high-level "traffic signal" based on various stats on what
 * this server is up to. A little more detail:
 *
 * An instance of this class gets hooked up to the monitor endpoint
 * `/traffic-signal` (see {@link Monitor}). That endpoint is meant to be used by
 * reverse proxies that front a fleet of instances of this product, in order to
 * determine which instances are safe to route traffic to. Under low or normal
 * load, the traffic signal is "go;" and when an instance becomes too loaded,
 * the signal is "stop."
 *
 * This class is set up so that the signal is never permanently set at "stop"
 * based on the perceived load,  even when under very heavy load. This is meant
 * to prevent a cross-fleet heavy load from turning into a complete outage. That
 * is, we do not assume that the incoming heavy load indicator is a perfect
 * metric, and we _do_ assume that it's better to continue to accept new traffic
 * (and, approximately, risk server meltdown) than to over-prophylactically
 * totally stop answering requests.
 *
 * In addition to using the high-level load factor to determine traffic flow,
 * this instance also pays attention to the self-assessed server "health" value,
 * _and_ whether or not the system is in the process of shutting down. With
 * both of these, the appropriate signal _does_ turn into a permanent "stop"
 * signal.
 */
export class TrafficSignal extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {boolean} Current traffic flow signal; `true` indicates that traffic is
     * allowed.
     */
    this._allowTraffic = true;

    /**
     * {Int} Wall time in msec since the Unix Epoch indicating the _next_ moment
     * when traffic should be allowed, if it is not currently allowed. This
     * value only has meaning when {@link #_allowTraffic} is `false`.
     */
    this._allowTrafficAtMsec = 0;

    /**
     * {Int} Wall time in msec before which {@link #_allowTraffic} is forced to
     * be `true` (based on load factor). This value only has meaning when
     * {@link #_allowTraffic} is `true`.
     */
    this._forceTrafficUntilMsec = 0;

    /**
     * {string} Brief "reason" for the current traffic situation. Used when
     * logging.
     */
    this._reason = 'initial state';

    /**
     * {boolean} Whether (`true`) or not (`false`) the system is currently
     * shutting down.
     */
    this._shuttingDown = false;

    /**
     * {boolean} Whether (`true`) or not (`false`) the system currently
     * considers itself to be "healthy."
     */
    this._healthy = true;

    /** {Int} Most recently reported high-level load factor. */
    this._loadFactor = 0;

    /**
     * {Int} Wall time in msec since the Unix Epoch, as passed to the most
     * recent call to {@link #allowTrafficAt}.
     */
    this._currentTimeMsec = 0;

    Object.seal(this);
  }

  /**
   * Indicates to this instance the current self-assessed health of this server.
   *
   * @param {boolean} healthy `true` if this server considers itself "healthy"
   *   or `false` if not.
   */
  health(healthy) {
    this._healthy = TBoolean.check(healthy);
  }

  /**
   * Indicates the current wall time, and gets back an indicator of whether or
   * not to allow traffic at the moment in question.
   *
   * **Note:** This method is arranged the way it is (that is, to take a time),
   * specifically so that the class does not have a built-in dependency on
   * `Date.now()` (or similar), so that it is more easily testable / tested.
   *
   * @param {Int} timeMsec The current wall time, as msec since the Unix Epoch.
   * @returns {boolean} Indication of whether (`true`) or not (`false`) traffic
   *   should be allowed as of `timeMsec`.
   */
  shouldAllowTrafficAt(timeMsec) {
    TInt.nonNegative(timeMsec);

    if (timeMsec < this._currentTimeMsec) {
      throw Errors.badUse('`timeMsec` must monotonically increase from call to call.');
    }

    this._currentTimeMsec = timeMsec;

    const oldValue = this._allowTraffic;
    this._recalc();
    const newValue = this._allowTraffic;

    if (oldValue !== newValue) {
      log.event.trafficSignal(newValue, this._reason);
    }

    return newValue;
  }

  /**
   * Indicates to this instance that this server is shutting down.
   */
  shuttingDown() {
    this._shuttingDown = true;
  }

  /**
   * Indicates to this instance the current high-level load factor.
   *
   * @param {Int} loadFactor The current load factor.
   */
  loadFactor(loadFactor) {
    TInt.nonNegative(loadFactor);

    this._loadFactor = loadFactor;
  }

  /**
   * Recalculates the traffic signal based on currently-known stats.
   */
  _recalc() {
    if (this._shuttingDown || !this._healthy) {
      this._allowTraffic       = false;
      this._allowTrafficAtMsec = NEVER_TIME_MSEC;
      this._reason = this._shuttingDown ? 'shutting down' : 'unhealthy';
      return;
    } else if (this._allowTrafficAtMsec === NEVER_TIME_MSEC) {
      // Neither shutting down nor unhealthy, so don't squelch traffic forever,
      // anymore.
      this._allowTrafficAtMsec = this._currentTimeMsec;
    }

    if (this._allowTraffic) {
      if (this._currentTimeMsec < this._forceTrafficUntilMsec) {
        // See explanation below and in the class header comment.
        return;
      }
    } else {
      if (this._currentTimeMsec >= this._allowTrafficAtMsec) {
        // This says in effect, "When the traffic signal goes from `false` to
        // `true`, it must be allowed to stay `true` for a minimum-specified
        // period of time." See class header comment for the rationale for this
        // behavior.
        this._allowTraffic          = true;
        this._forceTrafficUntilMsec = this._currentTimeMsec + MINIMUM_TRAFFIC_ALLOW_TIME_MSEC;
        this._reason                = 'forced uptime';
      }

      // The signal was `false` at the start of this call, and there is nothing
      // more to do. Either we're still holding the signal `false`, or we _just_
      // decided that it should be `true` (and held `true` for the appropriate
      // minimum time).
      return;
    }

    if (this._loadFactor <= MIN_LOAD_FACTOR_FOR_DUTY_CYCLE) {
      // Not enough load to have to cycle off. That is, it's all good!
      this._allowTraffic = true;
      this._reason       = 'normal flow';
      return;
    }

    // The load factor is high enough to start duty-cycling, and we are
    // currently allowing traffic, but we are now going to stop (for a while).

    const offTimeMsec = TrafficSignal._offTimeMsecFromLoadFactor(this._loadFactor);

    this._allowTraffic       = false;
    this._allowTrafficAtMsec = this._currentTimeMsec + offTimeMsec;
    this._reason             = 'avoiding load';
  }

  /**
   * Given a load factor at or above the minimum value required for
   * duty-cycling, returns the amount of time that should be spent in the "off"
   * state.
   *
   * @param {Int} loadFactor The load factor.
   * @returns {Int} The amount of time (in msec) which the traffic signal should
   *   be "off" before going back on again.
   */
  static _offTimeMsecFromLoadFactor(loadFactor) {
    if (loadFactor < MIN_LOAD_FACTOR_FOR_DUTY_CYCLE) {
      return 0;
    }

    // Scale the load factor to a range of `[0..1]`, where `0` is the minimum
    // value for duty cycling and `1` is the max.
    const LOAD_FACTOR_RANGE = MAX_LOAD_FACTOR_FOR_DUTY_CYCLE - MIN_LOAD_FACTOR_FOR_DUTY_CYCLE;
    const scaledLoad =
      Math.min(1, (loadFactor - MIN_LOAD_FACTOR_FOR_DUTY_CYCLE) / LOAD_FACTOR_RANGE);

    // Take the scaled load factor, and multiply it out, and adjust it, so that
    // it is in the desired range of "off" cycle fractions. E.g. if `offFrac` is
    // `0.25` then the duty cycle should be such that the off-time is 0.25 of
    // the minimum on-time.
    const FRAC_RANGE        = MAX_DUTY_CYCLE_OFF_TIME_FRAC - MIN_DUTY_CYCLE_OFF_TIME_FRAC;
    const offFrac = (scaledLoad * FRAC_RANGE) + MIN_DUTY_CYCLE_OFF_TIME_FRAC;

    // That the off-fraction (F) and the minimum on-time (T), and solve for N
    // (actual amount of time in msec to be off), as follows. The first line
    // in the derivation states fairly directly, "The ratio of off-time to
    // total time is F."
    //
    //   (N / (N + T)) = F
    //   N             = F * (N + T)
    //   N             = F*N + F*T
    //   N - F*N       = F * T
    //   1*N - F*N     = F * T
    //   (1 - F) * N   = F * T
    //   N             = (F * T) / (1 - F)
    const ON_MSEC     = MINIMUM_TRAFFIC_ALLOW_TIME_MSEC;
    const offTimeMsec = Math.round((offFrac * ON_MSEC) / (1 - offFrac));

    return offTimeMsec;
  }
}
