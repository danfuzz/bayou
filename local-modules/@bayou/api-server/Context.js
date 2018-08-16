// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import Target from './Target';
import TokenAuthorizer from './TokenAuthorizer';

/** {Logger} Logger. */
const log = new Logger('api');

/**
 * {Int} The amount of time in msec a target must be idle and unaccessed before
 * it is considered sufficiently idle to warrant automated cleanup.
 */
const IDLE_TIME_MSEC = 20 * 60 * 1000; // Twenty minutes.

/**
 * Binding context for an API server or session therein. Instances of this class
 * are used to map from IDs to `Target` instances, including targets which are
 * ephemerally bound to the session as well as ones that are authorized via
 * bearer tokens. In addition, this class is used to hold the knowledge of which
 * {@link Codec} to use for a session.
 */
export default class Context extends CommonBase {
  /**
   * Constructs an instance which is initially empty.
   *
   * @param {Codec} codec Codec to use for all connections / sessions.
   * @param {TokenAuthorizer|null} [tokenAuth = null] Optional authorizer for
   *   bearer tokens. If non-`null`, this is used to map bearer tokens into
   *   usable target objects.
   */
  constructor(codec, tokenAuth = null) {
    super();

    /** {Codec} The codec to use for connections / sessions. */
    this._codec = Codec.check(codec);

    /**
     * {TokenAuthorizer|null} If non-`null`, authorizer to use in order to
     * translate bearer tokens to target objects.
     */
    this._tokenAuth = (tokenAuth === null) ? null : TokenAuthorizer.check(tokenAuth);

    /** {Map<string, Target>} The underlying map. */
    this._map = new Map();

    Object.freeze(this);
  }

  /** {Codec} The codec to use for connections / sessions. */
  get codec() {
    return this._codec;
  }

  /** {TokenAuthorized} The token authorizer to use. */
  get tokenAuthorizer() {
    return this._tokenAuth;
  }

  /**
   * Adds a new target to this instance. This will throw an error if there is
   * already another target with the same ID. This is a convenience for calling
   * `map.addTarget(new Target(id, obj))`.
   *
   * @param {string|BaseKey} nameOrKey Either the name of the target (if
   *   uncontrolled) _or_ the key which controls access to the target. See the
   *   docs for `Target.add()` for more details.
   * @param {object} obj Object to ultimately call on.
   */
  add(nameOrKey, obj) {
    this.addTarget(new Target(nameOrKey, obj));
  }

  /**
   * Adds a new target to this instance, marking it as "evergreen" (immortal /
   * never idle). Other than evergreen marking, this is identical to
   * `this.add()`.
   *
   * @param {string|BaseKey} nameOrKey Either the name of the target (if
   *   uncontrolled) _or_ the key which controls access to the target.
   * @param {object} obj Object to ultimately call on.
   */
  addEvergreen(nameOrKey, obj) {
    const target = new Target(nameOrKey, obj);
    target.setEvergreen();
    this.addTarget(target);
  }

  /**
   * Adds an already-constructed `Target` to the map. This will throw an error
   * if there is already another target with the same ID.
   *
   * @param {Target} target Target to add.
   */
  addTarget(target) {
    Target.check(target);
    const id = target.id;

    if (this._map.get(id) !== undefined) {
      throw this._targetError(id, 'Duplicate target');
    }

    this._map.set(id, target);
  }

  /**
   * Clones this instance. The resulting clone has a separate underlying map.
   * That is, adding targets to the clone does not affect its progenitor.
   *
   * @returns {Context} The newly-cloned instance.
   */
  clone() {
    const result = new Context(this._codec, this._tokenAuth);

    for (const t of this._map.values()) {
      result.addTarget(t);
    }

    return result;
  }

  /**
   * Removes the target binding for the given ID. It is an error to try to
   * remove a nonexistent binding.
   *
   * @param {string} id The ID of the binding to remove.
   */
  deleteId(id) {
    this.get(id); // This will throw if `id` isn't bound.
    this._map.delete(id);
  }

  /**
   * Gets the target associated with the indicated ID. This will throw an
   * error if the so-identified target does not exist.
   *
   * @param {string} id The target ID.
   * @returns {Target} The so-identified target.
   */
  get(id) {
    const result = this.getOrNull(id);

    if (!result) {
      throw this._targetError(id);
    }

    return result;
  }

  /**
   * Gets an authorized target. This will find _uncontrolled_ (already
   * authorized) targets that were previously added via {@link #addTarget} as
   * well as those authorized by virtue of this method being passed a valid
   * authority-bearing token (in string form).
   *
   * **Note:** This is the only method on this class which understands how to
   * authorize bearer tokens. This is also the only `get*` method on this class
   * which is asynchronous. (It has to be asynchronous because token
   * authorization) is asynchronous. **TODO:** This situation is confusing and
   * should be cleaned up, one way or another.
   *
   * @param {string} idOrToken The target ID or a bearer token (in string form)
   *   which authorizes access to a target.
   * @returns {Target} The so-identified or so-authorized target.
   * @throws {Error} Thrown if `idOrToken` does not correspond to an authorized
   *   target.
   */
  async getAuthorizedTarget(idOrToken) {
    const tokenAuth = this._tokenAuth;

    if ((tokenAuth !== null) && tokenAuth.isToken(idOrToken)) {
      const token   = tokenAuth.tokenFromString(idOrToken);
      const already = this.getOrNull(token.id);

      if (already !== null) {
        // We've seen this token ID previously in this context / session.
        if (token.sameToken(already.key)) {
          // The corresponding secrets match. All's well!
          return already;
        } else {
          // The secrets don't match. This will happen, for example, when a
          // malicious actors tries to probe for a key.
          throw this._targetError(idOrToken);
        }
      }

      // It's the first time this token has been encountered in this context.
      // Determine its authorized target, and if authorized cache it in this
      // instance's target map.

      const targetObject = await tokenAuth.targetFromToken(token);

      if (targetObject === null) {
        throw this._targetError(idOrToken);
      }

      const target = new Target(token, targetObject);

      this.addTarget(target);
      return target;
    }

    // It's not a bearer token (or this instance doesn't deal with bearer tokens
    // at all). The ID can only validly refer to an uncontrolled target.

    return this.getUncontrolled(idOrToken);
  }

  /**
   * Gets the target associated with the indicated ID, but only if it is
   * controlled (that is, it requires auth). This will throw an error if the
   * so-identified target does not exist.
   *
   * @param {string} id The target ID.
   * @returns {Target} The so-identified target.
   */
  getControlled(id) {
    const result = this.get(id);

    if (result.key === null) {
      throw this._targetError(id, 'Not a controlled target');
    }

    return result;
  }

  /**
   * Gets the target associated with the indicated ID, or `null` if the
   * so-identified target does not exist.
   *
   * @param {string} id The target ID.
   * @returns {Target|null} The so-identified target, or `null` if unbound.
   */
  getOrNull(id) {
    TString.check(id);
    const result = this._map.get(id);
    return (result !== undefined) ? result : null;
  }

  /**
   * Gets the target associated with the indicated ID, but only if it is
   * uncontrolled (that is, no auth required). This will throw an error if the
   * so-identified target does not exist.
   *
   * @param {string} id The target ID.
   * @returns {Target} The so-identified target.
   */
  getUncontrolled(id) {
    const result = this.get(id);

    if (result.key !== null) {
      // This uses the default error message so as not to reveal that this ID
      // corresponds to a token.
      throw this._targetError(id);
    }

    return result;
  }

  /**
   * Returns an indication of whether or not this instance has a binding for
   * the given ID.
   *
   * @param {string} id The target ID.
   * @returns {boolean} `true` iff `id` is bound.
   */
  hasId(id) {
    return this.getOrNull(id) !== null;
  }

  /**
   * Cleans up (removes) bindings for targets that have become idle.
   */
  idleCleanup() {
    const idleLimit = Date.now() - IDLE_TIME_MSEC;
    const map = this._map;

    log.event.idleCleanup('start');

    // Note: The ECMAScript spec guarantees that it is safe to delete keys from
    // a map while iterating over it. See
    // <https://tc39.github.io/ecma262/#sec-runtime-semantics-forin-div-ofheadevaluation-tdznames-expr-iterationkind>.
    for (const [key, value] of map) {
      if (value.wasIdleAsOf(idleLimit)) {
        log.event.idleCleanupRemoved(key);
        map.delete(key);
      }
    }

    log.event.idleCleanup('done');
  }

  /**
   * Removes the key that controls the target with the given ID. It is an error
   * to try to operate on a nonexistent or uncontrolled target. This replaces
   * the `target` with a newly-constructed one that has no auth control; it
   * does _not_ modify the original `target` object (which is immutable).
   *
   * @param {string} id The ID of the target whose key is to be removed.
   */
  removeControl(id) {
    const target = this.getControlled(id);
    this._map.set(id, target.withoutKey());
  }

  /**
   * Starts automatically cleaning up idle targets on this instance. This
   * initiates a periodic task which iterates over all targets, removing ones
   * that have become idle.
   */
  startAutomaticIdleCleanup() {
    // We run the callback at a fraction of the overall idle timeout so as to
    // be a bit more prompt with the cleanup.
    setInterval(() => { this.idleCleanup(); }, IDLE_TIME_MSEC / 4);
  }

  /**
   * Constructs a target-related error in a standard form. In particular, it
   * redacts the given ID if it turns out to be a full token.
   *
   * @param {string} idOrToken ID or token to report about.
   * @param {string} [msg = 'Unknown target'] Pithy message about the problem.
   * @returns {Error} An appropriately-constructed error.
   */
  _targetError(idOrToken, msg = 'Unknown target') {
    const tokenAuth = this._tokenAuth;
    const idToReport = ((tokenAuth !== null) && tokenAuth.isToken(idOrToken))
      ? tokenAuth.tokenFromString(idOrToken).printableId
      : idOrToken;

    return Errors.badUse(`${msg}: ${idToReport}`);
  }
}
