// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { BaseLogger } from '@bayou/see-all';
import { TBoolean, TFunction, TInt, TObject, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import WeakCacheEntry from './WeakCacheEntry';

/**
 * Weak-reference based cache, with LRU-based additional cache retention. This
 * class manages a map from string identifiers to associated objects, with those
 * objects (a) held via weak references, such that they can be found again so
 * long as they're being kept alive by other means, and (b) held strongly in an
 * LRU cache, so as to avoid overzealous collection of objects during transient
 * disuse. Objects can be added synchronously or asynchronously. In the latter
 * case, this class accepts a promise to add, reserves the ID for the result,
 * and deals with both eventual resolution and rejection of the promise.
 *
 * This is an abstract base class. Subclasses must fill in a handful of methods
 * and synthetic properties to get a well-behaved instance.
 */
export default class BaseCache extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseLogger} log Logger instance to use.
   * @param {Int} maxLruSize Maximum number of elements to keep in the LRU
   *   cache.
   */
  constructor(log, maxLruSize) {
    super();

    /** {BaseLogger} Logger instance to use. */
    this._log = BaseLogger.check(log).withAddedContext('cache');

    /** {Int} Maximum number of elements to keep in the LRU cache. */
    this._maxLruSize = TInt.nonNegative(maxLruSize);

    /**
     * {class} Class (constructor function) for objects to be stored in this
     * instance.
     */
    this._cachedClass = TFunction.checkClass(this._impl_cachedClass);

    /**
     * {Map<string, WeakCacheEntry>} The weak-reference cache, specifically, a
     * map from each ID to an entry representing the associated object (in
     * various ways, see {@link WeakCacheEntry} for some detail).
     */
    this._weakCache = new Map();

    /**
     * {array<object>} The LRU cache, with the least-recently used entries at
     * smaller indices in the array and the most-recently used entry at the end.
     */
    this._lruCache = [];

    Object.freeze(this);
  }

  /**
   * Adds the given instance to the cache, both as a weak reference and strongly
   * at the head of the LRU cache (that is, as the _most_ recently referenced
   * object). It is an error to add an instance with an ID that is already
   * represented as a live cache entry.
   *
   * @param {object} obj Object to add to the cache.
   */
  add(obj) {
    const id = this._idFromObject(obj);

    if (this._isAlive(id)) {
      throw Errors.badUse(`ID already present in cache: ${id}`);
    }

    const ref = weak(obj, this._objectReaper(id));

    this._weakCache.set(id, new WeakCacheEntry(id, ref));
    this._mru(id, obj);

    this._log.event.added(id);
  }

  /**
   * Adds the given instance to the cache, as if by {@link #add}, but only after
   * the given value resolves as a promise. In the time after the call to this
   * method and _before_ the promise resolves, the instance is treated as being
   * in the cache (so, e.g., it is invalid to add another instance with the same
   * ID), except that (synchronous) {@link #getOrNull} will report an error.
   *
   * Should the promise ultimately become rejected (not resolved), it will
   * remain in the cache indefinitely as such, until and unless it is cleared
   * out via a call to {@link #clearRejection}.
   *
   * @param {string} id The ID of the object. This parameter is needed because
   *   a value needs to be added to the cache, but `objPromise` (it being a
   *   promise) cannot be synchronously interrogated for the ID (unlike the
   *   final resolved object).
   * @param {Promise} objPromise Promise for the value which is to be added to
   *   the cache.
   * @returns {object} The resolved value of `objPromise`. This return value
   *   becomes resolved _after_ the object has been added to the cache.
   */
  async addAfterResolving(id, objPromise) {
    TObject.check(objPromise, Promise);

    if (this._isAlive(id)) {
      throw Errors.badUse(`ID already present in cache: ${id}`);
    }

    this._weakCache.set(id, new WeakCacheEntry(id, objPromise));

    this._log.event.resolving(id);

    try {
      const obj = await objPromise;
      this._log.event.resolved(id);

      this._weakCache.delete(id); // Because otherwise `add()` will complain.
      this.add(obj);

      return obj;
    } catch (e) {
      this._log.event.rejected(id, e);
      this._weakCache.set(id, new WeakCacheEntry(id, e));
      throw e;
    }
  }

  /**
   * Removes a cache entry which indicates a rejected promise. It is an error if
   * the given ID isn't associated with a promise rejection in the cache.
   *
   * @param {string} id ID to remove from the cache.
   */
  clearRejection(id) {
    const entry  = this._getWeakCacheEntry(id);

    if ((entry === null) || (entry.error === null)) {
      throw Errors.badUse(`ID not rejected: ${id}`);
    }

    this._weakCache.delete(id);
    this._log.event.clearedRejection(id);
  }

  /**
   * Gets the instance associated with the given ID, if any. Returns `null`
   * if there is no such instance. If found, moves the instance to the front
   * of the LRU cache (that is, marks it as the _most_ recently used instance).
   *
   * In the case of an ID added via {@link #addAfterResolving} which is not yet
   * resolved, this method will throw an error.
   *
   * @param {string} id The ID to look up.
   * @returns {object|null} The corresponding instance, or `null` if no such
   *   instance is active.
   */
  getOrNull(id) {
    return this._getOrNull(id, false);
  }

  /**
   * Get the resolved object for the given ID in the weak cache, if any. If the
   * ID is associated with a (still alive and) resolved object or known
   * rejection (either by being added directly or by virtue of a fully completed
   * call to {@link #addAfterResolving}), this method returns promptly with that
   * object. If the ID is in the process of getting initialized, this method
   * eventually returns with the result (or rejection) of the promise which was
   * added (via {@link #addAfterResolving}). If the ID never had an associated
   * instance, or there was an instance but it is now dead, this method returns
   * `null`,
   *
   * @param {string} id The ID to look up.
   * @returns {object|null} The corresponding instance, or `null` if no such
   *   instance is active.
   */
  async getOrNullAfterResolving(id) {
    return this._getOrNull(id, true);
  }

  /**
   * Indicates that the given object &mdash; which should be cached by this
   * instance &mdash; is still in active use. This moves the object to the
   * most-recently-used position in the LRU cache.
   *
   * @param {object} obj Object to mark as recently used.
   */
  stillUsing(obj) {
    const id = this._idFromObject(obj);

    if (!this._isAlive(id)) {
      throw Errors.badUse(`ID not present in cache: ${id}`);
    }

    this._mru(id, obj);
  }

  /**
   * {class} Class (constructor function) for objects to be stored in instances
   * of this class.
   *
   * @abstract
   */
  get _impl_cachedClass() {
    return this._mustOverride();
  }

  /**
   * Gets the ID to use with the given cacheable object. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {object} obj A cacheable object.
   * @returns {string} The ID to use to represent `obj`.
   */
  _impl_idFromObject(obj) {
    return this._mustOverride(obj);
  }

  /**
   * Checks to see if an ID is valid for use with this instance. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {string} id The ID to check. Guaranteed to be a string by this
   *   class.
   * @returns {boolean} `true` if `id` is valid, or `false` if not.
   */
  _impl_isValidId(id) {
    return this._mustOverride(id);
  }

  /**
   * Validates an ID to be used with this instance. Returns `id` if valid.
   * Throws an error if not.
   *
   * @param {string} id The ID to check. Guaranteed to be a string by this
   *   class.
   * @returns {string} `id` if it is valid.
   * @throws {Error} Thrown if `id` is invalid.
   */
  _checkId(id) {
    TString.check(id);

    const valid = TBoolean.check(this._impl_isValidId(id));

    if (valid) {
      return id;
    }

    throw Errors.badValue(id, String, 'ID syntax');
  }

  /**
   * Helper for the two `getOrNull*()` variants, which gets the instance
   * associated with the given ID, if any, with optional erroring out in the
   * case of promises.
   *
   * @param {string} id The ID to look up.
   * @param {boolean} returnPromise If `true`, return a promise entry. If
   *   `false`, throw an error for them.
   * @returns {object|null} The corresponding instance, or `null` if no such
   *   instance is active.
   */
  _getOrNull(id, returnPromise) {
    const entry = this._getWeakCacheEntry(id, true);

    if (entry === null) {
      return null;
    }

    const result = entry.object;

    if (result !== null) {
      // We've seen cases where a weakly-referenced object gets collected and
      // replaced with an instance of a different class. If this check throws an
      // error, that's what's going on here. (This is evidence of a bug in Node
      // or in the `weak` package.)
      this._cachedClass.check(result);

      this._mru(id, result);
      return result;
    } else if (entry.error) {
      throw entry.error;
    } else if (entry.promise) {
      if (returnPromise) {
        return entry.promise;
      } else {
        throw Errors.badUse(`Cannot synchronously get asynchronously-initializing ID: ${id}`);
      }
    } else {
      throw Errors.wtf('Weird cache entry.');
    }
  }

  /**
   * Gets the ID to use with the given cacheable object.
   *
   * @param {object} obj A cacheable object.
   * @returns {string} The ID to use to represent `obj`.
   */
  _idFromObject(obj) {
    this._cachedClass.check(obj);

    const id = this._impl_idFromObject(obj);

    return this._checkId(id);
  }

  /**
   * Indicates whether the given ID is currently represented by a live weak
   * cache entry.
   *
   * @param {string} id The ID in question.
   * @returns {boolean} `true` if `id` is currently associated with a live cache
   *   entry, or `false` if not.
   */
  _isAlive(id) {
    const entry = this._getWeakCacheEntry(id);

    return (entry !== null) && entry.isAlive();
  }

  /**
   * Gets the object directly present in the weak cache for the given ID, if
   * any, or returning `null` if there is no entry. If there is an entry which
   * turns out to be a dead weak reference, this method also returns `null`.
   * That is, if this method returns non-`null`, then the entry is guaranteed
   * _not_ to be a for a dead weak reference.
   *
   * @param {string} id ID in question.
   * @param {boolean} [log = false] If `true`, logs the activity.
   * @returns {WeakCacheEntry|null} The entry associated with `id` in the weak
   *   cache, or `null` if either there is none or the entry represents a dead
   *   weak reference.
   */
  _getWeakCacheEntry(id, log = false) {
    this._checkId(id);

    const entry = this._weakCache.get(id);

    if (!entry) {
      if (log) {
        this._log.event.notCached(id);
      }

      return null;
    }

    if (!entry.isAlive()) {
      // `entry` refers to a dead weak reference. We don't bother removing the
      // dead entry from `_weakCache` here, because in all likelihood the very
      // next thing that will happen is that the calling code is going to
      // re-instantiate the associated object and add it back. Also, a dead
      // entry doesn't take up much space in memory.

      if (log) {
        this._log.event.foundDead(id);
      }

      return null;
    }

    if (log) {
      this._log.event.retrieved(id);
    }

    return entry;
  }

  /**
   * Makes the given object be in the _most_ recently used position in the LRU
   * cache, adding it if it was not already present or moving it if it was. If
   * the addition of the object would make the LRU cache too big, trims it.
   *
   * @param {string} id The ID of the object in question.
   * @param {object} obj Object to mark as _most_ recently used.
   */
  _mru(id, obj) {
    const cache   = this._lruCache;
    const foundAt = cache.indexOf(obj);

    if (foundAt === -1) {
      cache.push(obj);

      this._log.event.lruAdded(id);

      while (cache.length > this._maxLruSize) {
        const dropped = cache.shift();
        this._log.event.lruDropped(this._idFromObject(dropped));
      }
    } else {
      cache.splice(foundAt, 1);
      cache.push(obj);

      this._log.event.lruPromoted(id);
    }
  }

  /**
   * Constructs and returns a post-mortem finalizer (reaper) for a weak
   * reference on the object with the given ID.
   *
   * @param {string} id ID in question.
   * @returns {function} Appropriately-constructed post-mortem finalizer.
   */
  _objectReaper(id) {
    return () => {
      this._log.event.reaped(id);

      // Clear the cache entry, but only if it hasn't already been replaced with
      // a new live entry. (Without the check, we'd have a concurrency hazard.)
      if (!this._isAlive(id)) {
        this._weakCache.delete(id);
      }
    };
  }
}
