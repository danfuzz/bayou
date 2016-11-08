// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import fs_extra from 'fs-extra';
import path from 'path';
import Watchpack from 'watchpack';

import SeeAll from 'see-all';

/** Logger. */
const log = new SeeAll('dev-mode');

/**
 * Development mode handler. This expects to be invoked when the product is
 * running in an `out` directory under a source repo. It synchs the client
 * files from the original source, so that the Webpack "watcher" will find
 * updated code and do its bundling thing. Should the build ever include non-JS
 * assets, these would also get picked up here.
 */
export default class DevMode {
  /**
   * Constructs an instance. Use `start()` to run it.
   */
  constructor() {
    /**
     * Original client source directories, each of which is expected to end
     * _without_ a slash. If there is more than one element, then _earlier_
     * directories are taken to overlay _later_ ones.
     */
    this._copyFrom = DevMode._makeCopyFrom();

    /** Target directory for client files. */
    this._copyTo = path.resolve(__dirname, '../client');
  }

  /**
   * Calculates the value for `_copyFrom` based on the build info file.
   */
  static _makeCopyFrom() {
    let sourceDir = null;
    let overlayDir = null;

    const infoText =
      fs.readFileSync(path.resolve(__dirname, '../build-info.txt'), 'utf8');
    for (let line of infoText.match(/^.*$/mg)) {
      if (line === '') {
        continue;
      }

      const setting = line.match(/^([^=]*)='(.*)'$/);
      const key = setting[1];
      const value = setting[2];
      switch (key) {
        case 'sourceDir':  { sourceDir  = value; break; }
        case 'overlayDir': { overlayDir = value; break; }
      }
    }

    let result = [];
    for (let dir of [overlayDir, sourceDir]) {
      if ((dir === null) || (dir.length === 0)) {
        continue;
      }
      result.push(path.resolve(dir, 'client'));
    }

    return result;
  }

  /**
   * Finds the best (topmost) existing file with the given partial path. If
   * there is none, returns `null`.
   */
  _findFile(relativePath) {
    for (let candidate of this._copyFrom) {
      const fullPath = path.resolve(candidate, relativePath);
      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch (e) {
        // Not accessible. Continue iterating.
      }
    }

    return null;
  }

  /**
   * Handles the fact of a changed or removed file. Copies or deletes, as
   * appropriate, including making any needed new directories.
   */
  _handleUpdate(fromPath) {
    let basePath = null;
    let relativePath = null;

    // Hack off the `copyFrom` prefix. Because there might be more than one source
    // directory, we have to iterate over all the possibilities until we find a
    // hit.
    for (let candidate of this._copyFrom) {
      const clen = candidate.length;
      if ((fromPath.length > clen)
          && (candidate === fromPath.substring(0, clen))
          && (fromPath[clen] === '/')) {
        basePath = candidate;
        relativePath = fromPath.substring(clen + 1);
        break;
      }
    }

    if (basePath === null) {
      log.error(`[dev-mode] Weird path: ${fromPath}`);
      return;
    }

    const toPath = path.resolve(this._copyTo, relativePath);
    const sourcePath = this._findFile(relativePath);

    if (sourcePath === null) {
      fs.unlinkSync(toPath);
      log.info(`[dev-mode] Removed: ${relativePath}`);
    } else if (sourcePath === fromPath) {
      // We only end up here if the file that changed is the "most overlaid" one.
      // That is, if `foo.js` has an overlay, and we just noticed that the base
      // (non-overlay) version of `foo.js` changed, then we _don't_ try to copy
      // it.
      fs_extra.ensureDirSync(path.dirname(toPath));
      fs_extra.copySync(fromPath, toPath, { clobber: true, dereference: false });
      log.info(`[dev-mode] Updated: ${relativePath}`);
    }
  }

  /**
   * Starts up the instance. After this call, it will monitor the client source
   * directory, copying any changed file into the output, and relaying file
   * removals as well.
   */
  start() {
    const wp = new Watchpack({
      aggregateTimeout: 1000, // Wait 1sec (1000msec) after change detection.
    });

    // Start watching. The last argument indicates the time after which files
    // will be considered changed. We set it to 10 seconds in the past to handle
    // the fact that we might be delayed a bit between when the build was first
    // done and when we got fired up here.
    wp.watch([], this._copyFrom, Date.now() - (10 * 1000));

    // Monitor file changes and removals.

    wp.on('change', (path, mtime) => {
      this._handleUpdate(path);
    });

    wp.on('remove', (path) => {
      // TODO: This event doesn't seem to get triggered consistently. Not sure
      // why. Look into it.
      this._handleUpdate(path);
    });
  }
}
