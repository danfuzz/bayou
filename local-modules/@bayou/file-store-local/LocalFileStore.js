// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fse from 'fs-extra';
import path from 'path';

import { Codec } from '@bayou/codec';
import { Dirs } from '@bayou/env-server';
import { BaseFileStore, FileCache } from '@bayou/file-store';
import { TheModule as fileStoreOt_TheModule } from '@bayou/file-store-ot';
import { DefaultIdSyntax } from '@bayou/doc-id-default';
import { Logger } from '@bayou/see-all';

import LocalFile from './LocalFile';

/** {Logger} Logger for this module. */
const log = new Logger('local-file');

/**
 * File storage implementation that stores everything in the locally-accessible
 * filesystem.
 */
export default class LocalFileStore extends BaseFileStore {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /** {Codec} Codec to use when reading and writing file OT objects. */
    this._codec = new Codec();
    fileStoreOt_TheModule.registerCodecs(this._codec.registry);

    /** {FileCache} Cache of {@link LocalFile} instances. */
    this._cache = new FileCache(log);

    /** {string} The directory for file storage. */
    this._dir = path.resolve(Dirs.theOne.VAR_DIR, 'files');

    /**
     * {boolean} `true` iff the file storage directory is known to exist. Set
     * to `true` in `_ensureFileStorageDirectory()`.
     */
    this._ensuredDir = false;

    log.event.storageDirectory(this._dir);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} fileId The ID of the file to access.
   * @returns {BaseFile} Accessor for the file in question.
   */
  async _impl_getFile(fileId) {
    await this._ensureFileStorageDirectory();

    const already = this._cache.getOrNull(fileId);

    if (already) {
      return already;
    }

    const result = new LocalFile(fileId, this._filePath(fileId), this._codec);

    this._cache.add(result);
    return result;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} fileId The ID of the file to query.
   * @returns {object} Information about the file (or would-be file).
   */
  async _impl_getFileInfo(fileId) {
    const filePath = this._filePath(fileId);
    const exists   = await fse.pathExists(filePath);

    return {
      valid: true, // This module has no additional ID validity requirements.
      exists
    };
  }

  /**
   * Implementation as required by the superclass. This implementation defers
   * to the module {@link @bayou/doc-id-default}.
   *
   * @param {string} fileId The alleged file ID.
   * @returns {boolean} `true` if `fileId` is a syntactically valid file ID, or
   *   `false` if not.
   */
  _impl_isFileId(fileId) {
    return DefaultIdSyntax.isFileId(fileId);
  }

  /**
   * Ensures the file storage directory exists. This will only ever check once
   * (on first file construction attempt), which notably means that things will
   * break if something removes the file storage directory without restarting
   * the server.
   */
  async _ensureFileStorageDirectory() {
    if (this._ensuredDir) {
      return;
    }

    if (!(await fse.pathExists(this._dir))) {
      await fse.mkdir(this._dir);
      log.event.createdStorageDirectory();
    }

    this._ensuredDir = true;
  }

  /**
   * Gets the filesystem path for the file with the given ID.
   *
   * @param {string} fileId The file ID.
   * @returns {string} The corresponding filesystem path.
   */
  _filePath(fileId) {
    // The URI encoding helps keep this code resilient with respect to possible
    // variance in the allowed syntax for `fileId`s.
    return path.resolve(this._dir, encodeURIComponent(fileId));
  }
}
