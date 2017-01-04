#!/usr/bin/env node
// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
//
// This is a wrapper for the Babel compiler, which calls it in a preconfigured
// way. This is used instead of calling on the `babel-cli` bin specifically
// because the CLI tool can't be told to find source files and plugin files in
// different directories. (That is, it conflates the code for itself with the
// code to be processed.)

'use strict';

var fs = require('fs');
var path = require('path');

var babel = require('babel-core');

/**
 * Compiles a single file.
 */
function compileFile(inputFile, outputFile) {
  let inputStat = null;
  let outputStat = null;

  try {
    inputStat = fs.statSync(inputFile);
    outputStat = fs.statSync(outputFile);
    if (inputStat.mtime > outputStat.mtime) {
      console.log('Unchanged', inputFile);
    }
  } catch (e) {
    if (inputStat === null) {
      console.log('File not found:', inputFile);
      process.exit(1);
    }
    // Trouble statting the output file. It probably doesn't exist, which is
    // a-okay. Just fall through to the compiler.
  }

  let output = babel.transformFileSync(inputFile,
    {
      filename: inputFile,
      sourceMaps: 'inline',

      // We have to resolve the presets "manually."
      presets: ['es2015', 'es2016', 'es2017'].map(function (name) {
        return require.resolve(`babel-preset-${name}`);
      })
    });

  fs.writeFileSync(outputFile, output.code);
  console.log('Compiled', inputFile);
}

/**
 * Compiles a directory.
 */
function compileDir(inputDir, outputDir) {
  let files = fs.readdirSync(inputDir);
  for (let i = 0; i < files.length; i++) {
    let f = files[i];
    let inputFile = path.resolve(inputDir, f);
    let outputFile = path.resolve(outputDir, f);
    let stat = fs.statSync(inputFile);
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

let input = process.argv[2];
let output = process.argv[3];

let stat = fs.statSync(input);
if (stat.isDirectory()) {
  compileDir(input, output);
} else {
  compileFile(input, output);
}
