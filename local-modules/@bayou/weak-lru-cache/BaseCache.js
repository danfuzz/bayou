// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { BaseLogger } from '@bayou/see-all';
import { TBoolean, TFunction, TInt, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Weak-reference based cache, with LRU-based additional cache retention. This
 * class manages a map from string identifiers to associated objects, with those
 * objects (a) held via weak references, such that they can be found again so
 * long as they're being kept alive by other means, and (b) held strongly in an
 * LRU cache, so as to avoid overzealous collection of objects during transient
 * disuse.
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
     * {Map<string, Weak>} The weak-reference cache, specifically, a map from
     * IDs to weak references to associated objects.
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
   * Gets the instance associated with the given ID, if any. Returns `null`
   * if there is no such instance. If found, moves the instance to the front
   * of the LRU cache (that is, marks it as the _most_ recently used instance).
   *
   * @param {string} id The ID to look up.
   * @param {boolean} [quiet = false] If `true`, suppress log spew. (This is
   *   meant for intra-class usage.)
   * @returns {object|null} The corresponding instance, or `null` if no such
   *   instance is active.
   */
  getOrNull(id, quiet = false) {
    this._checkId(id);

    const ref = this._weakCache.get(id);

    if (!ref) {
      if (!quiet) {
        this._log.event.notCached(id);
      }

      return null;
    }

    const result = weak.get(ref);

    if (!result) {
      // `result` is `undefined`, which is to say, `ref` is a dead weak
      // reference. We don't bother removing the dead entry from `_weakCache`,
      // because in all likelihood the very next thing that will happen is that
      // the calling code is going to re-instantiate the associated object and
      // add it back. Also, a dead reference doesn't take up much space in
      // memory.

      if (!quiet) {
        this._log.event.foundDead(id);
      }

      return null;
    }

    // We've seen cases where a weakly-referenced object gets collected and
    // replaced with an instance of a different class. If this check throws an
    // error, that's what's going on here. (This is evidence of a bug in Node or
    // in the `weak` package.)
    this._cachedClass.check(result);

    this._mru(id, result, quiet);

    if (!quiet) {
      this._log.event.retrieved(id);
    }

    return result;
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
    const id      = this._idFromObject(obj);
    const already = this.getOrNull(id, true);

    if (already !== null) {
      throw Errors.badUse(`ID already present in cache: ${id}`);
    }

    const ref = weak(obj, this._objectReaper(id));

    this._weakCache.set(id, ref);
    this._mru(id, obj);

    this._log.event.added(id);
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
   * Makes the given object be in the _most_ recently used position in the LRU
   * cache, adding it if it was not already present or moving it if it was. If
   * the addition of the object would make the LRU cache too big, trims it.
   *
   * @param {string} id The ID of the object in question.
   * @param {object} obj Object to mark as _most_ recently used.
   * @param {boolean} quiet If `true`, suppress log spew. (This is meant for
   *   intra-class usage.)
   */
  _mru(id, obj, quiet) {
    const cache   = this._lruCache;
    const foundAt = cache.indexOf(obj);

    if (foundAt === -1) {
      cache.push(obj);

      if (!quiet) {
        this._log.event.lruAdded(id);
      }

      while (cache.length > this._maxLruSize) {
        const dropped = cache.shift();
        if (!quiet) {
          this._log.event.lruDropped(this._idFromObject(dropped));
        }
      }
    } else {
      cache.splice(foundAt, 1);
      cache.push(obj);

      if (!quiet) {
        this._log.event.lruPromoted(id);
      }
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
      // a new live reference. (Without the check, we'd have a concurrency
      // hazard.)
      if (this.getOrNull(id, true) === null) {
        this._weakCache.delete(id);
      }
    };
  }
}
