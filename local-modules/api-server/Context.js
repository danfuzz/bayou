// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';
import { Logger } from 'see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import Target from './Target';

/** {Logger} Logger. */
const log = new Logger('api');

/**
 * {Int} The amount of time in msec a target must be idle and unaccessed before
 * it is considered sufficiently idle to warrant automated cleanup.
 */
const IDLE_TIME_MSEC = 20 * 60 * 1000; // Twenty minutes.

/**
 * Binding context for an API server or session therein. This is mostly just a
 * map from IDs to `Target` instances, along with reasonably straightforward
 * accessor and update methods. In addition, this is what knows which {@link
 * Codec} to use.
 */
export default class Context extends CommonBase {
  /**
   * Constructs an instance which is initially empty.
   *
   * @param {Codec} codec Codec to use for all connections / sessions.
   */
  constructor(codec) {
    super();

    /** {Codec} The codec to use for connections / sessions. */
    this._codec = Codec.check(codec);

    /** {Map<string, Target>} The underlying map. */
    this._map = new Map();

    Object.freeze(this);
  }

  /** {Codec} The codec to use for connections / sessions. */
  get codec() {
    return this._codec;
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
      throw Errors.badUse(`Duplicate target: \`${id}\``);
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
    const result = new Context(this._codec);

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
      throw Errors.badUse(`Unknown target: \`${id}\``);
    }

    return result;
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
      throw Errors.badUse(`Not a controlled target: \`${id}\``);
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
      throw Errors.badUse(`Unauthorized target: \`${id}\``);
    }

    return result;
  }

  /**
   * Gets the target associated with the indicated ID, but only if it is
   * uncontrolled (that is, no auth required).
   *
   * @param {string} id The target ID.
   * @returns {Target|null} The so-identified target if it is in fact bound and
   *   uncontrolled, or `null` if it is either unbound or access-controlled.
   */
  getUncontrolledOrNull(id) {
    const result = this.getOrNull(id);
    return ((result !== null) && (result.key === null)) ? result : null;
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
}
