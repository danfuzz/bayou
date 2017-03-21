// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { PromDelay } from 'util-common';

/** {Int} How long an unanswered challenge remains active for, in msec. */
const CHALLENGE_TIMEOUT_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * Class to handle meta-requests.
 */
export default class MetaHandler {
  /**
   * Constructs an instance.
   *
   * @param {Connection} connection The connection.
   */
  constructor(connection) {
    /** {Connection} The connection. */
    this._connection = connection;

    /** {SeeAll} The connection-specific logger. */
    this._log = connection.log;

    /**
     * {Map<challenge, {id, response}>} Map from challenge string to associated
     * ID and response.
     */
    this._activeChallenges = new Map();
  }

  /**
   * Called to respond to a successful challenge (which was presumably made via
   * `makeChallenge()`. If `challenge` and `response` correspond to an active
   * challenge-response pair, then this method will remove the key that controls
   * the associated target, in the current session. (Other sessions will not be
   * affected, including sessions created later.) It is only ever valid to
   * respond to any given challenge once.
   *
   * This method will throw an error if the arguments don't refer to an active
   * challenge (because it never existed, because it was already used, or
   * because it expired).
   *
   * @param {string} challenge The challenge string.
   * @param {string} response The challenge response.
   */
  authWithChallengeResponse(challenge, response) {
    TString.check(challenge);
    TString.check(response);

    const challengeInfo = this._activeChallenges.get(challenge);

    if (!challengeInfo || (response !== challengeInfo.response)) {
      // **Note:** We don't differentiate reasons for rejection (beyond type
      // checking, above), as that could reveal security-sensitive info.
      throw new Error('Invalid challenge pair.');
    }

    const id = challengeInfo.id;

    // Remove the challenge from the active set, so that a given challenge can
    // only be used once.
    this._activeChallenges.delete(challenge);

    // The main action: Replace the target for `id` with an equivalent one
    // except without auth control.
    this._connection.context.removeControl(id);

    this._log.info(`Authed challenge: ${id} ${challenge}`);
  }

  /**
   * Generates and returns a challenge for the key that controls the target with
   * the given ID. It is an error to request a challenge for a nonexistent or
   * uncontrolled target. Once returned, challenges are considered active only
   * for a limited amount of time (approximately five minutes), after which
   * they are expired.
   *
   * @param {string} id Target whose key is to be challenged.
   * @returns {string} A challenge string that can subsequently be answered so
   *   as to remove key control for the target, in the context of the current
   *   session.
   */
  makeChallenge(id) {
    const target = this._connection.context.getControlled(id);

    let challengePair;
    for (;;) {
      challengePair = target.key.makeChallengePair();
      if (!this._activeChallenges.get(challenge)) {
        break;
      }

      // We managed to get a duplicate challenge. This is highly unusual, but
      // it _can_ happen. So, just iterate and try again.
    }

    const { challenge, response } = challengePair;

    // Store the challenge, and arrange for its expiry.

    this._activeChallenges.set(challenge, { id, response });
    PromDelay.resolve(CHALLENGE_TIMEOUT_MSEC).then(() => {
      if (this._activeChallenges.delete(challenge)) {
        // `delete` returns `true` to indicate that the value was found. In this
        // case, it means that it expired.
        this._log.info(`Challenge expired: ${id} ${challenge}`);
      }
    });

    // **Note:** It's probably okay to log the expected response, but may be
    // worth thinking a bit more about. (Attention: Security professionals!)
    this._log.info(`New challenge: ${id} ${challenge}`);
    this._log.info(`  => ${response}`);

    return challenge;
  }

  /**
   * API meta-method `connectionId`: Returns the connection ID that is assigned
   * to this connection. This is only meant to be used for logging. For example,
   * it is _not_ guaranteed to be unique.
   *
   * @returns {string} The connection ID.
   */
  connectionId() {
    return this._connection.connectionId;
  }

  /**
   * API meta-method `ping`: No-op method that merely verifies (implicitly) that
   * the connection is working. Always returns `true`.
   *
   * @returns {boolean} `true`, always.
   */
  ping() {
    return true;
  }

  /**
   * Gets the schema(ta) for the given object(s), by ID. This returns an object
   * that maps each given ID to its corresponding schema. It is only valid to
   * pass IDs for uncontrolled (no authorization required) resources.
   *
   * @param {...string} ids IDs of the object to inquire about.
   * @returns {object} An object mapping each of the `ids` to its corresponding
   *   schema.
   */
  schemaFor(...ids) {
    const result = {};

    for (const id of ids) {
      const target = this._connection.context.getUncontrolled(id);
      result[id] = target.schema.propertiesObject;
    }

    return result;
  }
}
