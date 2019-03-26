// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { BaseLogger } from '@bayou/see-all';
import { TBoolean, TFunction, TInt, TString } from '@bayou/typecheck';
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
   */
  constructor(log) {
    super();

    /** {BaseLogger} Logger instance to use. */
    this._log = BaseLogger.check(log).withAddedContext('cache');

    /** {Int} Maximum number of elements to keep in the LRU cache. */
    this._maxLruSize = TInt.nonNegative(this._impl_maxLruSize);

    /** {Int} Maximum age (msec) of rejection entries. */
    this._maxRejectionAge = TInt.nonNegative(this._impl_maxRejectionAge);

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

    this._weakCache.set(id, new WeakCacheEntry(this._now(), id, ref));
    this._mru(id, obj);

    this._log.event.added(id);
  }

  /**
   * Gets the instance associated with the given ID, if any. Returns `null`
   * if there is no such instance. If found, moves the instance to the front
   * of the LRU cache (that is, marks it as the _most_ recently used instance).
   *
   * In the case of an ID added via {@link #resolveOrAdd} which is not yet
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
   * call to {@link #resolveOrAdd}), this method returns promptly with that
   * object. If the ID is in the process of getting initialized, this method
   * eventually returns with the result (or rejection) of the promise which was
   * added (via {@link #resolveOrAdd}). If the ID never had an associated
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
   * Gets the instance (or rejection) in the weak cache for the given ID, if
   * there is any, as if by {@link #getOrNullAfterResolving}; or if there is no
   * entry for the ID, adds it asynchronously by calling the given object maker
   * function and calling {@link #add} on the result, with the ID reserved in
   * the meantime (to avoid double initialization).
   *
   * In the case of an add, in the time after the call to this method and
   * _before_ the promise resolves, the instance is treated as being in the
   * cache (so, e.g., it is invalid to add another instance with the same ID),
   * except that (synchronous) {@link #getOrNull} will report an error. Should
   * the promise ultimately become rejected (not resolved), it will remain in
   * the cache until it "ages" out per this instance's configuration for same
   * (see {@link #_impl_maxRejectionAge}).
   *
   * @param {string} id The ID of the object.
   * @param {function} objMaker Function which is expected to return a suitable
   *   object (or promise) for storage in the cache at `id` if/when called.
   * @returns {object} The retrieved or created object for `id`. This return
   *   value becomes resolved _after_ the object has been added to the cache.
   */
  async resolveOrAdd(id, objMaker) {
    // If `id` is bound to a rejected asynchronous add, then this method call
    // will -- correctly -- throw an exception.
    const already = this._getOrNull(id, true);

    if (already !== null) {
      return already;
    }

    // There is currently no binding for `id`. Reserve it by binding the result
    // of an asynchronous call of `objMaker()` to a `WeakCacheEntry` for that
    // `id`. And finally, arrange for the reservation to be replaced with a more
    // direct result (object or error) once the call returns (or throws).

    const objPromise = (async () => objMaker())();

    this._weakCache.set(id, new WeakCacheEntry(this._now(), id, objPromise));
    this._log.event.resolving(id);

    try {
      const obj = await objPromise;

      this._log.event.resolved(id);
      this._weakCache.delete(id); // Because otherwise `add()` will complain.
      this.add(obj);

      return obj;
    } catch (e) {
      this._log.event.rejected(id, e);
      this._weakCache.set(id, new WeakCacheEntry(this._now(), id, e));
      throw e;
    }
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
   * {Int} Maximum size (in entries) of the LRU cache. This many added object
   * entries will be explicitly maintained in an alive state by this instance.
   *
   * @abstract
   */
  get _impl_maxLruSize() {
    return this._mustOverride();
  }

  /**
   * {Int} Maximum age (in msec) for a promise rejection cache entry, before it
   * is discarded (literally, or effectively ignored).
   *
   * @abstract
   */
  get _impl_maxRejectionAge() {
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
   * Helper for {@link #getOrNull}, {@link #getOrNullAfterResolving}, and
   * {@link #resolveOrAdd}, which gets the instance associated with the given
   * ID, if any, with optional erroring out in the case of promises.
   *
   * @param {string} id The ID to look up.
   * @param {boolean} returnPromise If `true`, return a promise entry. If
   *   `false`, throw an error for them.
   * @returns {object|null} The corresponding instance, or `null` if no such
   *   instance is active.
   */
  _getOrNull(id, returnPromise) {
    const { entry, obj } = this._getWeakCacheEntry(id, true);

    if (obj !== null) {
      this._mru(id, obj);
      return obj;
    } else if (entry === null) {
      return null;
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
    const { obj } = this._getWeakCacheEntry(id);

    return (obj !== null);
  }

  /**
   * Gets the entry in the weak cache for the given ID along with a (strong)
   * reference to the entry's otherwise weakly-held reference, with `null`
   * bound as appropriate in case there is no entry at all and/or the entry has
   * no associated strong reference (e.g. because it is a dead weak reference or
   * is some other kind of entry).
   *
   * @param {string} id ID in question.
   * @param {boolean} [log = false] If `true`, logs the activity.
   * @returns {object} Ad-hoc plain object mapping `entry` to the
   *   {@link WeakCacheEntry} if any (or `null`) and `obj` to a (strong)
   *   reference to the cached object if any (or `null`).
   */
  _getWeakCacheEntry(id, log = false) {
    this._checkId(id);

    const entry    = this._weakCache.get(id) || null;
    let   obj      = null;
    let   logEvent = null;

    if (entry === null) {
      logEvent = 'notCached';
    } else if (entry.weak !== null) {
      obj = entry.object;
      if (obj === null) {
        // `entry` refers to a dead weak reference. We don't bother removing the
        // dead entry from `_weakCache` here, because in all likelihood the very
        // next thing that will happen is that the calling code is going to
        // re-instantiate the associated object and add it back. Also, a dead
        // entry doesn't take up much space in memory. Also, the reaper will
        // ultimately remove the reference if warranted (and note it in the
        // log).
        logEvent = 'foundDead';
      } else {
        // We've seen cases where a weakly-referenced object gets collected and
        // replaced with an instance of a different class. If this check throws
        // an error, that's what's going on here. (This is evidence of a bug in
        // Node or in the `weak` package.)
        this._cachedClass.check(obj);
        logEvent = 'retrievedObject';
      }
    } else if (entry.promise !== null) {
      logEvent = 'retrievedPromise';
    } else if (entry.error !== null) {
      // It's a promise rejection, but it might have aged out.
      if (entry.createTimeMsec < (this._now() - this._maxRejectionAge)) {
        // Aged out.
        this._weakCache.delete(id);
        logEvent = 'discardedError';
      } else {
        logEvent = 'retrievedError';
      }
    }

    if (log) {
      this._log.event[logEvent](id);
    }

    return { entry, obj };
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
   * Gets the current time, in the usual Unix Epoch msec form.
   *
   * **TODO:** Make this configurable per subclass, especially to help with
   * testing.
   *
   * @returns {Int} The current time in msec since the Unix Epoch.
   */
  _now() {
    return Date.now();
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
