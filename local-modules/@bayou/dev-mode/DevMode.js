// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chokidar from 'chokidar';
import fs from 'fs';
import fs_extra from 'fs-extra';
import path from 'path';

import { Dirs } from '@bayou/env-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { Singleton } from '@bayou/util-common';

/** Logger. */
const log = new Logger('dev-mode');

/** File name for source directory maps. */
const MAP_FILE_NAME = 'source-map.txt';

/**
 * Development mode handler. This expects to be invoked when the product is
 * running in an `out` directory under a source repo. This does two things:
 *
 * * It synchs the client (web browser) files from the original source, so that
 *   the Webpack "watcher" will find updated code and do its bundling thing.
 *
 * * It looks for changes to the server source files, and exits the application
 *   should they change. This is paired with a wrapper script (`develop`), which
 *   notices when the process exits and kicks off a rebuild and then restarts
 *   the server.
 *
 * **Note:** This class supports an arrangement whereby source directories can
 * get "overlaid" (i.e., two directories getting combined into a single
 * effective source directory), which was used in an earlier version of the
 * system to enable customization without having to fork the code. The build
 * system as of this writing no longer supports overlays, but the actual code to
 * support it here is pretty minimal, so it remains.
 */
export class DevMode extends Singleton {
  /**
   * Constructs the instance. Use `start()` to run it.
   */
  constructor() {
    super();

    /** {string} Base product output directory. */
    this._outDir = Dirs.theOne.BASE_DIR;

    /**
     * {object} The mappings from source to target directories, for the client
     * code.
     */
    this._clientMappings =
      DevMode._makeMappings(path.resolve(this._outDir, 'client'));

    /**
     * {object} The mappings from source to target directories, for the server
     * code.
     */
    this._serverMappings =
      DevMode._makeMappings(path.resolve(this._outDir, 'server'));

    /**
     * {boolean} Are we in the middle of shutting down (due to a server change)?
     */
    this._shuttingDown = false;
  }

  /**
   * Constructs and returns the source mappings.
   *
   * @param {string} copyTo Destination directory.
   * @param {array} [soFar = []] Partial result (passed through to recursive
   *   calls).
   * @param {boolean} [first = true] Whether this is the top-level call.
   * @returns {object} The constructed mappings.
   */
  static _makeMappings(copyTo, soFar = [], first = true) {
    const files = fs.readdirSync(copyTo);
    for (const f of files) {
      const p = path.resolve(copyTo, f);
      if (f === MAP_FILE_NAME) {
        // Reads the map file and splits it into lines. The map file lists
        // base (underlay) directories before overlay directories.
        const dirs = fs.readFileSync(p, 'utf8').match(/.+(?=\n)/g);
        for (const d of dirs) {
          // `priority` is used to get the sort to respect overlay order.
          soFar.push({ from: d, to: copyTo, priority: soFar.length });
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
          log.wtf('Unordered mappings.');
          return null; // Appease the linter.
        }
      });

      // Strip the priorities.
      for (const m of soFar) {
        delete m.priority;
      }
    }

    return soFar;
  }

  /**
   * Gets the relative portion of the given path, with respect to `_outDir`.
   *
   * @param {string} p Filesystem path to process.
   * @returns {string} The relative portion of `p` with respect to `_outDir`.
   */
  _relativeOutPath(p) {
    const outWithSlash = `${this._outDir}/`;
    if (p.startsWith(outWithSlash)) {
      return p.substring(outWithSlash.length);
    } else {
      log.wtf('Bad out path:', p);
      return null; // Appease the linter.
    }
  }

  /**
   * Finds the best source mapping (the earliest listed one in the given
   * `mappings`) that covers the given target file with an _existing_ file.
   * Returns the source file that would / should be copied to `toPath`, if such
   * a file exists, or `null` if no such file exists.
   *
   * @param {object} mappings Which mappings to use. Should be either
   *   `_clientMappings` or `_serverMappings`.
   * @param {string} toPath The path to look for.
   * @returns {string|null} The corresponding source path, or `null` if none.
   */
  _getFromPath(mappings, toPath) {
    for (const candidate of mappings) {
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
   * Finds the target file path associated with the given source file, if any,
   * based on the given `mappings`. The target file doesn't necessarily have to
   * already exist. Returns `null` if there is no mapping that covers the source
   * file.
   *
   * @param {object} mappings Which mappings to use. Should be either
   *   `_clientMappings` or `_serverMappings`.
   * @param {string} fromPath The path to look for.
   * @returns {string|null} The corresponding target path, or `null` if none.
   */
  _getToPath(mappings, fromPath) {
    for (const candidate of mappings) {
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
   * Resolves a changed file with respect to the given `mappings`, if any.
   * If the file is covered by the mappings, then this returns an object that
   * maps `fromPath` (the argument, or `null` if the file was deleted) and
   * `toPath` (where the file lands in the output). If the file isn't covered
   * by source, then this returns `null`.
   *
   * @param {object} mappings Which mappings to use. Should be either
   *   `_clientMappings` or `_serverMappings`.
   * @param {string} fromPath The path of the source file that was changed (or
   *   removed).
   * @returns {object|null} An object indicating its resolution, or `null` if it
   *   doesn't correspond to a covered file.
   */
  _resolveChange(mappings, fromPath) {
    // Map the given file (the source file that just changed) to a target file
    // path.
    const toPath = this._getToPath(mappings, fromPath);

    if (toPath === null) {
      // This file has no mapping into the target directory.
      log.info('Unmapped:', fromPath);
      return null;
    }

    // Map that target back to a source file. This might not be the same as the
    // path we started with: (1) The file that changed might have been overlaid.
    // (2) The file that changed might have been removed.
    const bestFromPath = this._getFromPath(mappings, toPath);

    // The nice relative path to use when logging.
    const logPath = this._relativeOutPath(toPath);

    if (bestFromPath === null) {
      // The file was deleted.
      log.info('Removed:', logPath);
    } else if (fromPath === bestFromPath) {
      // The file that changed is the "most overlaid" one. That is, if `foo.js`
      // has an overlay, and we just noticed that the base (non-overlay) version
      // of `foo.js` changed, then we _don't_ report it as changed.
      log.info('Updated:', logPath);
    } else {
      // It's an underlay file.
      log.info('Ignored:',  logPath);
      return null;
    }

    return { fromPath: bestFromPath, toPath };
  }

  /**
   * Handles the fact of a changed or removed client file. Copies or deletes, as
   * appropriate, including making any needed new directories.
   *
   * @param {string} fromPath The path of the source file that was changed (or
   *   removed).
   */
  _handleClientChange(fromPath) {
    if (this._shuttingDown) {
      // Don't bother doing anything if we're about to exit.
      return;
    }

    const resolved = this._resolveChange(this._clientMappings, fromPath);

    if (resolved === null) {
      // Not a salient file.
      return;
    }

    const toPath = resolved.toPath;
    fromPath = resolved.fromPath;

    if (fromPath === null) {
      // The source file was deleted.
      try {
        fs.unlinkSync(toPath);
      } catch (e) {
        // Ignore the error. The file was probably removed out from under us,
        // which is no big deal. This has been observed to happen when
        // development is done semi-remotely, e.g. `rsync`ing files from a
        // laptop to a machine in a dev-production environment.
        log.info('Already removed:', toPath);
      }
    } else {
      // The source file changed.
      fs_extra.ensureDirSync(path.dirname(toPath));
      fs_extra.copySync(fromPath, toPath, { clobber: true, dereference: false });
    }
  }

  /**
   * Handles the fact of a changed or removed server file. If the file turns
   * out to be used, this exits the application.
   *
   * @param {string} fromPath The path of the source file that was changed (or
   *   removed).
   */
  async _handleServerChange(fromPath) {
    if (this._shuttingDown) {
      // Don't bother doing anything if we're about to exit.
      return;
    }

    const resolved = this._resolveChange(this._serverMappings, fromPath);

    if (resolved === null) {
      // Not a salient file.
      return;
    }

    // Give the system a few seconds to settle (e.g., let the logs get flushed
    // out reasonably naturally, and give the developer a couple seconds to
    // make other changes so as not to thrash too much), and then exit.

    this._shuttingDown = true;
    log.info('Server file changed. About to exit...');

    await Delay.resolve(5 * 1000);
    process.exit();
  }

  /**
   * Starts up the instance, including both client code synchronization and
   * server code monitoring.
   */
  async start() {
    const clientReady =
      this._startWatching(this._clientMappings, this._handleClientChange);
    const serverReady =
      this._startWatching(this._serverMappings, this._handleServerChange);

    // Log a note after everything is ready.
    await clientReady;
    await serverReady;
    log.event.running();
  }

  /**
   * Helper for `start()` which sets up a watcher for a given set of files and
   * does an initial scan of the watched files (to catch changes that happen
   * during application startup).
   *
   * @param {object} mappings The mappings to watch. Should be one of
   *   `_clientMappings` or `_serverMappings`.
   * @param {function} onChange Method to call when a change is noticed.
   * @returns {Promise<boolean>} A promise that resolves to `true` as soon as
   *   monitoring is fully set up and active.
   */
  _startWatching(mappings, onChange) {
    // Extract just the `from` directories of the mappings.
    const watchDirs = mappings.map((m) => { return m.from; });

    // Start watching.
    const watcher = chokidar.watch(watchDirs, { ignoreInitial: true });

    // Monitor file adds, changes, and removals.
    const handler = onChange.bind(this);
    watcher.on('add',    handler);
    watcher.on('change', handler);
    watcher.on('unlink', handler);

    // At the moment when the watcher tells us it's actually going to send
    // updates, do an initial scan to find files that were updated _just before_
    // the watcher was looking. This catches cases where a file got modified as
    // the system was just starting up.

    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    const minTime = Date.now() - (10 * 1000); // Ten seconds in the past.

    watcher.on('ready', () => {
      // Only look for changes through the current moment (well, just _after_
      // the current moment, to catch some otherwise would-be edge cases). Later
      // changes will get caught by `watcher`.
      const maxTime = Date.now() + 1000; // One second in the future.
      this._initialChanges(watchDirs, minTime, maxTime, handler);

      // Initial scan is done. Resolve the (outer) return value.
      resolveReady(true);
    });

    return ready;
  }

  /**
   * Helper for `start()` which does an initial scan for changes.
   *
   * @param {array} watchDirs Array of directories to watch.
   * @param {number} minTime Start of time range of interest.
   * @param {number} maxTime End of time range of interest. The only changes
   *   that get reported are ones that take place between `minTime` (inclusive)
   *   and `maxTime` (inclusive).
   * @param {function} handler Function to call on each detected change, passing
   *   it the path of the changed (or removed) file.
   */
  _initialChanges(watchDirs, minTime, maxTime, handler) {
    const changes = [];
    for (const dir of watchDirs) {
      addChangesForDir(dir);
    }

    if (changes.length === 0) {
      // Our intrepid developer isn't in fact typing furiously at the moment.
      return;
    }

    log.info('Caught changes from just before starting...');

    // Sort the list of changes, so we can easily squelch duplicates (which will
    // be adjacent).
    changes.sort();
    let prev = null;
    for (const c of changes) {
      if (c !== prev) {
        handler(c);
        prev = c;
      }
    }

    // Called above for each scanned directory.
    function addChangesForDir(dir) {
      let files;

      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        if (e.code === 'ENOENT') {
          // `ENOENT` is an indication that the directory doesn't exist. This
          // can happen if a source directory (including a local module) has
          // been removed. It's innocuous, so just ignore it.
          return;
        }

        // Any other error gets rethrown up the chain.
        throw e;
      }

      for (const f of files) {
        const p = `${dir}/${f}`;
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          addChangesForDir(p);
        } else if (stat.isFile()) {
          const mtime = stat.mtime.getTime(); // Modification time.
          if ((mtime >= minTime) && (mtime <= maxTime)) {
            changes.push(p);
          }
        }
      }
    }
  }
}
