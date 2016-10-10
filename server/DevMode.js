// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Development mode handler. This expects to be invoked when the product is
 * running in an `out` directory inside a source repo. It synchs the client
 * files from the original source, so that updated static assets can be served
 * and so that the Webpack "watcher" will find updated code and do its bundling
 * thing.
 */

import fs from 'fs';
import fs_extra from 'fs-extra';
import path from 'path';
import Watchpack from 'watchpack';

import log from './log';

/**
 * Original client source directories, each of which is expected to end
 * _without_ a slash. Gets set in `start()`. If there is more than one element,
 * then _earlier_ directories are taken to overlay _later_ ones.
 */
var copyFrom = [];

/** Target directory for client files. */
var copyTo = path.resolve(__dirname, '../client');


/**
 * Find the best (topmost) existing file with the given partial path. If there
 * is none, returns `null`.
 */
function findFile(relativePath) {
  for (let candidate of copyFrom) {
    let fullPath = path.resolve(candidate, relativePath);
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
function handleUpdate(fromPath) {
  var basePath = null;
  var relativePath = null;

  // Hack off the `copyFrom` prefix. Because there might be more than one source
  // directory, we have to iterate over all the possibilities until we find a
  // hit.
  for (let candidate of copyFrom) {
    let clen = candidate.length;
    if ((fromPath.length > clen)
        && (candidate === fromPath.substring(0, clen))
        && (fromPath[clen] === '/')) {
      basePath = candidate;
      relativePath = fromPath.substring(clen + 1);
      break;
    }
  }

  if (basePath === null) {
    log('[dev-mode] Weird path: ' + fromPath);
    return;
  }

  var toPath = path.resolve(copyTo, relativePath);
  var sourcePath = findFile(relativePath);

  if (sourcePath === null) {
    fs.unlinkSync(toPath);
    log('[dev-mode] Removed: ' + relativePath);
  } else if (sourcePath === fromPath) {
    // We only end up here if the file that changed is the "most overlaid" one.
    // That is, if `foo.js` has an overlay, and we just noticed that the base
    // (non-overlay) version of `foo.js` changed, then we _don't_ try to copy
    // it.
    fs_extra.ensureDirSync(path.dirname(toPath));
    fs_extra.copySync(fromPath, toPath, { clobber: true, dereference: false });
    log('[dev-mode] Updated: ' + relativePath);
  }
}

/**
 * Initializes `copyFrom` based on the build info file.
 */
function initSources() {
  var sourceDir = null;
  var overlayDir = null;

  var infoText =
    fs.readFileSync(path.resolve(__dirname, '../build-info.txt'), 'utf8');
  for (let line of infoText.match(/^.*$/mg)) {
    if (line === '') {
      continue;
    }

    var setting = line.match(/^([^=]*)='(.*)'$/);
    var key = setting[1];
    var value = setting[2];
    switch (key) {
      case 'sourceDir':  { sourceDir  = value; break; }
      case 'overlayDir': { overlayDir = value; break; }
    }
  }

  copyFrom = [];
  for (let dir of [overlayDir, sourceDir]) {
    if ((dir === null) || (dir.length === 0)) {
      continue;
    }
    copyFrom.push(path.resolve(dir, 'client'));
  }
}

export default class DevMode {
  static start() {
    initSources();

    var wp = new Watchpack({
      aggregateTimeout: 1000, // Wait 1sec (1000msec) after change detection.
    });

    // Start watching. The last argument indicates the time after which files
    // will be considered changed. We set it to 10 seconds in the past to handle
    // the fact that we might be delayed a bit between when the build was first
    // done and when we got fired up here.
    wp.watch([], copyFrom, Date.now() - (10 * 1000));

    // Monitor file changes and removals.

    wp.on('change', function (path, mtime) {
      handleUpdate(path);
    });

    wp.on('remove', function (path) {
      // TODO: This event doesn't seem to get triggered consistently. Not sure
      // why. Look into it.
      handleUpdate(path);
    });
  }
}
