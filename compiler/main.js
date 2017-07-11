// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
//
// This is a wrapper for the Babel compiler, which calls it in a preconfigured
// way. This is used instead of calling on the `babel-cli` bin specifically
// because the CLI tool can't be told to find source files and plugin files in
// different directories. (That is, it conflates the code for itself with the
// code to be processed.)

// This file is run within a console, and as such `console` is a-okay.
/* eslint-disable no-console */

'use strict';

const babel = require('babel-core');
const chalk    = require('chalk');
const fs       = require('fs');
const fs_extra = require('fs-extra');
const path     = require('path');

/** How many files reported errors? */
let errorCount = 0;

/** Babel configuration, _except_ for the file name. */
const BABEL_CONFIG = Object.freeze({
  sourceMaps: 'inline',

  presets: [
    [
      'env',
      { targets: { node: 6 } }
    ]
  ]
});

/**
 * Gets a short log-friendly version of the given file path.
 *
 * @param {string} file Path to the file.
 * @returns {string} Log-friendly version.
 */
function pathForLogging(file) {
  // Trim up to and including `node_modules/`.
  if (/\/node_modules\//.test(file)) {
    return file.replace(/^.*\/node_modules\//, '.../');
  }

  // Not under `node_modules`. Just trim off initial path components to produce
  // a shorter string.
  while (file.length > 30) {
    const newFile = file.replace(/^\/?([^/]+\/){2}/, '.../');
    if (newFile === file) {
      break;
    }
    file = newFile;
  }

  return file;
}

/**
 * Compiles a single file.
 *
 * @param {string} inputFile Path to the input file.
 * @param {string} outputFile Path to the output file.
 */
function compileFile(inputFile, outputFile) {
  let inputStat = null;
  let outputStat = null;
  const pathToLog = pathForLogging(inputFile);

  try {
    inputStat = fs.statSync(inputFile);
    outputStat = fs.statSync(outputFile);
    // **TODO:** Newer versions of Node have a numeric `mtimeMs` field on stats
    // objects. Would be great to use it instead of `valueOf()`.
    if (inputStat.mtime.valueOf() <= outputStat.mtime.valueOf()) {
      console.log(chalk.gray.bold('Unchanged:'), chalk.gray(pathToLog));
      return;
    }
  } catch (e) {
    if (inputStat === null) {
      console.log('File not found:', inputFile);
      process.exit(1);
    }
    // Trouble statting the output file. It probably doesn't exist, which is
    // a-okay. Just fall through to the compiler.
  }

  let output = null;

  try {
    const config = Object.assign({ filename: inputFile }, BABEL_CONFIG);
    output = babel.transformFileSync(inputFile, config);
  } catch (e) {
    console.log(e.message);
    if (e.codeFrame) {
      console.log(e.codeFrame);
    }
    errorCount++;
  }

  if (output !== null) {
    fs_extra.ensureDirSync(path.dirname(outputFile));
    fs.writeFileSync(outputFile, output.code);
    console.log(chalk.green.bold('Compiled: '), pathToLog);
  }
}

/**
 * Compiles a directory.
 *
 * @param {string} inputDir Path of the input directory.
 * @param {string} outputDir Path of the output directory.
 */
function compileDir(inputDir, outputDir) {
  const files = fs.readdirSync(inputDir);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const inputFile = path.resolve(inputDir, f);
    const outputFile = path.resolve(outputDir, f);
    const stat = fs.statSync(inputFile);
    if (stat.isDirectory(f)) {
      if (f !== 'node_modules') {
        compileDir(inputFile, outputFile);
      }
    } else {
      if (f.match(/\.js$/)) {
        compileFile(inputFile, outputFile);
      }
    }
  }
}

const input = process.argv[2];
const output = process.argv[3];

const stat = fs.statSync(input);
if (stat.isDirectory()) {
  compileDir(input, output);
} else {
  compileFile(input, output);
}

if (errorCount !== 0) {
  console.log(`${errorCount} file${errorCount === 1 ? '' : 's'} with errors.`);
  process.exit(1);
}
