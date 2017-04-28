// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import fs from 'fs';
import path from 'path';

import { Dirs } from 'server-env';

describe('server-env.Dirs', () => {
  describe('BASE_DIR', () => {
    it('should return a directory path that exists', () => {
      const baseDir = Dirs.BASE_DIR;

      assert.isTrue(fs.existsSync(baseDir));
    });
  });

  describe('CLIENT_DIR', () => {
    it('should return a known subdirectory off of BASE_DIR', () => {
      const baseDir = Dirs.BASE_DIR;
      const clientDir = path.join(baseDir, 'client');

      assert.strictEqual(clientDir, Dirs.CLIENT_DIR);
      assert.isTrue(fs.existsSync(clientDir));
    });
  });

  describe('CLIENT_CODE_DIR', () => {
    it('should return a known subdirectory off of CLIENT_DIR', () => {
      const clientDir = Dirs.CLIENT_DIR;
      const codeDir = path.join(clientDir, 'js');

      assert.strictEqual(codeDir, Dirs.CLIENT_CODE_DIR);
      assert.isTrue(fs.existsSync(codeDir));
    });
  });

  describe('SERVER_DIR', () => {
    it('should return a known subdirectory off of BASE_DIR', () => {
      const baseDir = Dirs.BASE_DIR;
      const serverDir = path.join(baseDir, 'server');

      assert.strictEqual(serverDir, Dirs.SERVER_DIR);
      assert.isTrue(fs.existsSync(serverDir));
    });
  });

  describe('VAR_DIR', () => {
    it('should return a known subdirectory off of BASE_DIR', () => {
      const baseDir = Dirs.BASE_DIR;
      const varDir = path.join(baseDir, 'var');

      assert.strictEqual(varDir, Dirs.VAR_DIR);
      assert.isTrue(fs.existsSync(varDir));
    });
  });
});
