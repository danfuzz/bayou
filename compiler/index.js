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

const babel    = require('babel-core');
const chalk    = require('chalk');
const fs       = require('fs');
const fs_extra = require('fs-extra');
const minimist = require('minimist');
const path     = require('path');

/** Babel configuration, _except_ for the file name. */
const BABEL_CONFIG = Object.freeze({
  sourceMaps: 'inline',

  presets: [
    [
      'env',
      { targets: { node: 8 } }
    ],
    [
      'react'
    ]
  ]
});

/**
 * Displays a usage message and exits the process.
 *
 * @param {boolean} error Indicates whether or not the process should exit with
 *   an error indicator.
 */
function usage(error) {
  const progName = path.basename(process.argv[1]);
  [
    'Usage:',
    '',
    `${progName} [--in-dir=<path>] [--out-dir=<path>] <path> ...`,
    '',
    '  Compile one or more files. Does not compile files that appear to be',
    '  older than their corresponding output file. <path>s may be either files',
    '  or directories.',
    '',
    '  --in-dir=<path>',
    '    All source files must reside under the given path. Output file paths',
    '    are produced by stripping this prefix from input paths and appending the',
    '    result to the output directory. Defaults to the current directory.',
    '  --out-dir=<path>',
    '    Directory to write results to. Defaults to the input directory.',
    '',
    `${progName} [--help | -h]`,
    '  Display this message.'
  ].forEach((line) => {
    console.log(line);
  });
  process.exit(error ? 1 : 0);
}

/** {boolean} Error during argument processing? */
let argError = false;

/**
 * {object} Parsed command-line options. **Note:** The `slice` gets rid of the
 * `node` binary name and the name of the initial script (that is, this file).
 */
const opts = minimist(process.argv.slice(2), {
  boolean: ['help'],
  string: ['in-dir', 'out-dir'],
  alias: {
    'h': 'help'
  },
  stopEarly: true,
  unknown: (arg) => {
    if (/(^[^-]|^-$)/.test(arg)) {
      // It's just a regular (non-option) argument. Arguably it's a bug that
      // minimist calls here with it.
      return true;
    }
    console.log(`Unrecognized option: ${arg}`);
    argError = true;
    return false;
  }
});

if (argError || opts['help']) {
  usage(argError);
}

/** {string} Input directory. */
const inDir = (opts['in-dir'] || process.cwd()).replace(/[/]*$/, '/');

/** {string} Output directory. */
const outDir = opts['out-dir'] || inDir;

/**
 * {string} `[input, output]` path pairs, which are all validated and
 * canonicalized.
 */
const paths = opts['_'].map((p) => {
  const resolved = path.resolve(inDir, p);
  if (!(resolved.startsWith(inDir) || (`${resolved}/` === inDir))) {
    // eslint-disable-next-line no-console
    console.log(`Invalid path (not under input directory): ${p}`);
    usage(true);
  }

  const relative = resolved.slice(inDir.length);
  return [resolved, path.resolve(outDir, relative)];
});

/** {number} How many files compiled? */
let compileCount = 0;

/** {number} How many files reported errors? */
let errorCount = 0;

/**
 * Gets a short log-friendly version of the given file path.
 *
 * @param {string} file Path to the file.
 * @returns {string} Log-friendly version.
 */
function pathForLogging(file) {
  // Trim up to and including `node_modules/`.
  if (/[/]node_modules[/]/.test(file)) {
    return file.replace(/^.*[/]node_modules[/]/, '.../');
  }

  // Not under `node_modules`. Just trim off initial path components to produce
  // a shorter string.
  while (file.length > 30) {
    const newFile = file.replace(/^[/]?([^/]+[/]){2}/, '.../');
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
    if (inputStat.mtimeMs <= outputStat.mtimeMs) {
      console.log(chalk.gray.bold('Unchanged:'), chalk.gray(pathToLog));
      return;
    }
  } catch (e) {
    if (inputStat === null) {
      console.log('File not found:', inputFile);
      errorCount++;
      return;
    }
    // Trouble statting the output file. It probably doesn't exist, which is
    // a-okay. Just fall through to the compiler.
  }

  let output = null;

  compileCount++;

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

    // Update the access and modification time to make it look like the output
    // file was written one second after the original instead of when it was
    // actually written (which will generally be much later). This is done to
    // make it so that subsequent builds won't mistakenly think a compiled file
    // is up-to-date in the case where the source file was updated in the
    // middle of a build.
    const newTime = Math.ceil(inputStat.mtimeMs / 1000) + 1;
    fs.utimesSync(outputFile, newTime, newTime);

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

/**
 * Compiles either a file or a directory.
 *
 * @param {string} inputPath Input path.
 * @param {string} outputPath Output path.
 */
function compileOne(inputPath, outputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory(inputPath)) {
    compileDir(inputPath, outputPath);
  } else {
    compileFile(inputPath, outputPath);
  }
}

for (const [inputPath, outputPath] of paths) {
  compileOne(inputPath, outputPath);
}

if (compileCount === 0) {
  console.log(chalk.gray.bold('No files compiled.'));
} else {
  const compileMsg = `${compileCount} file${(compileCount === 1) ? '' : 's'} compiled.`;
  console.log(chalk.bold(compileMsg));

  if (errorCount === 0) {
    console.log(chalk.gray.bold('No errors.'));
  } else {
    console.log(chalk.red.bold(`${errorCount} file${errorCount === 1 ? '' : 's'} with errors.`));
    process.exit(1);
  }
}
