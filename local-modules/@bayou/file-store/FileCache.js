// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import BaseFile from './BaseFile';


/**
 * Cache of active instances of {@link BaseFile}, built by using a `Map` with
 * weakly-held values.
 */
export default class FileCache extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger instance to use.
   */
  constructor(log) {
    super();

    /**
     * {Map<string, Weak<BaseFile>>} The cache, as a map from file IDs to
     * weak file references.
     */
    this._cache = new Map();

    /** {Logger} Logger instance to use. */
    this._log = Logger.check(log).withAddedContext('cache');

    Object.freeze(this);
  }

  /**
   * Gets the file instance associated with the given ID, if any. Returns `null`
   * if there is no such instance.
   *
   * @param {string} fileId The file ID to look up.
   * @param {boolean} [quiet = false] If `true`, suppress log spew. (This is
   *   meant for intra-class usage.)
   * @returns {BaseFile|null} The corresponding file instance, or `null` if no
   *   such instance is active.
   */
  getOrNull(fileId, quiet = false) {
    TString.check(fileId);

    const fileRef = this._cache.get(fileId);

    if (!fileRef) {
      if (!quiet) {
        this._log.event.notCached(fileId);
      }

      return null;
    }

    if (weak.isDead(fileRef)) {
      // We don't bother removing the dead entry, because in all likelihood the
      // very next thing that will happen is that the calling code is going to
      // re-instantiate the file and add it.

      if (!quiet) {
        this._log.event.dead(fileId);
      }

      return null;
    }

    const result = BaseFile.check(weak.get(fileRef));

    if (!quiet) {
      this._log.event.retrieved(fileId);
    }

    return result;
  }

  /**
   * Adds the given file instance to the cache. It is an error to add an
   * instance with an ID that is already represented in the cache (by a live
   * object).
   *
   * @param {BaseFile} file File to add to the cache.
   */
  add(file) {
    BaseFile.check(file);

    const id      = file.id;
    const already = this.getOrNull(id, true);

    if (already !== null) {
      throw Errors.badUse(`ID already present in cache: ${id}`);
    }

    const fileRef = weak(file, this._fileReaper(id));

    this._cache.set(id, fileRef);
    this._log.event.added(id);
  }

  /**
   * Constructs and returns a post-mortem finalizer (reaper) for a weak
   * reference on the file with the given ID.
   *
   * @param {string} fileId ID of the file in question.
   * @returns {function} Appropriately-constructed post-mortem finalizer.
   */
  _fileReaper(fileId) {
    return () => {
      this._log.event.reaped(fileId);

      // Clear the cache entry, but only if it hasn't already been replaced with
      // a new live reference. (Without the check, we'd have a concurrency
      // hazard.)
      if (this.getOrNull(fileId) === null) {
        this._cache.delete(fileId);
      }
    };
  }
}
