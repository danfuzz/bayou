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

/** File name for source directory maps. */
const MAP_FILE_NAME = 'source-map.txt';

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
    /** Base product output directory. */
    this._outDir = path.resolve(__dirname, '..');
    log.info('Product directory:', this._outDir);

    /** The mappings from source to target directories. */
    this._mappings =
      DevMode._makeMappings(path.resolve(this._outDir, 'client'));
  }

  /**
   * Constructs and returns the source mappings.
   */
  static _makeMappings(copyTo, soFar = [], first = true) {
    const files = fs.readdirSync(copyTo);
    for (let f of files) {
      const p = path.resolve(copyTo, f);
      if (f === MAP_FILE_NAME) {
        // Reads the map file and splits it into lines.
        const dirs = fs.readFileSync(p, 'utf8').match(/.+(?=\n)/g);
        for (let d of dirs) {
          // `priority` is used to get the sort to respect overlay order.
          soFar.push({from: d, to: copyTo, priority: soFar.length});
        }
      } else if (fs.statSync(p).isDirectory()) {
        DevMode._makeMappings(p, soFar, false);
      }
    }

    if (first) {
      // This is the top-level call. Sort the elements by the
      // reverse-alphabetical sort order of the destination path, and by
      // high-to-low priority.
      //
      // The former causes subdirectories to end up earlier in the result than
      // their corresponding superdirectories. This ensures that the
      // subdirectories' mapping will be respected (as they effectively
      // "overlay" their corresponding superdirectories).
      //
      // The latter causes overlays to come before underlays.
      soFar.sort((x, y) => {
        if (x.to < y.to) {
          return 1;
        } else if (x.to > y.to) {
          return -1;
        } else if (x.priority < y.priority) {
          return 1;
        } else if (x.priority > y.priority) {
          return -1;
        } else {
          // Shouldn't happen, because no two items should have the same
          // priority.
          log.wtf('Unordered mappings.')
        }
      });

      // Strip the priorities.
      for (let m of soFar) {
        delete m.priority;
      }
    }

    return soFar;
  }

  /**
   * Gets the relative portion of the given path, with respect to `_outDir`.
   */
  _relativeOutPath(path) {
    const outWithSlash = `${this._outDir}/`;
    if (path.startsWith(outWithSlash)) {
      return path.substring(outWithSlash.length);
    } else {
      log.wtf('Bad out path:', path);
    }
  }

  /**
   * Finds the best source mapping (the earliest listed one in `_mappings`) that
   * covers the given target file with an _existing_ file. Returns the source
   * file that would / should be copied to `toPath`, if such a file exists, or
   * `null` if no such file exists.
   */
  _getFromPath(toPath) {
    for (let candidate of this._mappings) {
      const toDir = `${candidate.to}/`;
      if (toPath.startsWith(toDir)) {
        // The path is covered by this candidate. Get the partial path for it
        // with respect to the candidate, and append that to the candidate's
        // source directory to produce the final path.
        const partialPath = toPath.substring(toDir.length);
        const fromPath = `${candidate.from}/${partialPath}`;

        // See if the source file exists. If so, we have a winner!
        try {
          fs.accessSync(fromPath, fs.constants.R_OK);
          return fromPath;
        } catch (e) {
          // Not accessible. Continue iterating.
        }
      }
    }

    return null;
  }

  /**
   * Finds the target file path associated with the given source file, if any.
   * The target file doesn't necessarily have to already exist. Returns `null`
   * if there is no mapping that covers the source file.
   */
  _getToPath(fromPath) {
    for (let candidate of this._mappings) {
      const fromDir = `${candidate.from}/`;
      if (fromPath.startsWith(fromDir)) {
        // The path is covered by this candidate. Get the partial path for it
        // with respect to the candidate, and append that to the candidate's
        // target directory to produce the final path.
        const partialPath = fromPath.substring(fromDir.length);
        return `${candidate.to}/${partialPath}`;
      }
    }

    return null;
  }

  /**
   * Handles the fact of a changed or removed file. Copies or deletes, as
   * appropriate, including making any needed new directories.
   */
  _handleUpdate(fromPath) {
    // Map the given file (the source file that just changed) to a target file
    // path.
    const toPath = this._getToPath(fromPath);

    if (toPath === null) {
      // This file has no mapping into the target directory.
      log.info(`Unmapped: ${fromPath}`)
      return;
    }

    // Map that target back to a source file. This might not be the same as the
    // path we started with: (1) The file that changed might have been overlaid.
    // (2) The file that changed might have been removed.
    const bestFromPath = this._getFromPath(toPath);

    // The nice relative path to use when logging.
    const logPath = this._relativeOutPath(toPath);

    if (bestFromPath === null) {
      // The file was deleted.
      fs.unlinkSync(toPath);
      log.info(`Removed: ${logPath}`);
    } else if (fromPath === bestFromPath) {
      // The file that changed is the "most overlaid" one. That is, if `foo.js`
      // has an overlay, and we just noticed that the base (non-overlay) version
      // of `foo.js` changed, then we _don't_ try to copy it.
      fs_extra.ensureDirSync(path.dirname(toPath));
      fs_extra.copySync(fromPath, toPath, {clobber: true, dereference: false});
      log.info(`Updated: ${logPath}`);
    } else {
      // It's an underlay file.
      log.info(`Ignored: ${logPath}`)
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

    // Extract just the `from` directories of the mappings.
    const copyFrom = this._mappings.map((m) => { return m.from; });

    // Start watching. The last argument indicates the time after which files
    // will be considered changed. We set it to 10 seconds in the past to handle
    // the fact that we might be delayed a bit between when the build was first
    // done and when we got fired up here.
    wp.watch([], copyFrom, Date.now() - (10 * 1000));

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
