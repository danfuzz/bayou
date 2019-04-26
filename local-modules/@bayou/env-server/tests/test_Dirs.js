// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import fs from 'fs';
import path from 'path';

import { Dirs } from '@bayou/env-server';

describe('@bayou/env-server/Dirs', () => {
  describe('.BASE_DIR', () => {
    it('is a directory path that exists', () => {
      const baseDir = Dirs.theOne.BASE_DIR;

      assert.isTrue(fs.existsSync(baseDir));
    });
  });

  describe('.CLIENT_DIR', () => {
    it('is a known subdirectory off of `BASE_DIR`', () => {
      const baseDir = Dirs.theOne.BASE_DIR;
      const clientDir = path.join(baseDir, 'client');

      assert.strictEqual(Dirs.theOne.CLIENT_DIR, clientDir);
      assert.isTrue(fs.existsSync(clientDir));
    });
  });

  describe('.CONTROL_DIR', () => {
    it('is a known subdirectory off of `VAR_DIR`', () => {
      const varDir = Dirs.theOne.VAR_DIR;
      const controlDir = path.join(varDir, 'control');

      assert.strictEqual(Dirs.theOne.CONTROL_DIR, controlDir);
      assert.isTrue(fs.existsSync(controlDir));
    });
  });

  describe('.LOG_DIR', () => {
    it('is a known subdirectory off of `VAR_DIR`', () => {
      const varDir = Dirs.theOne.VAR_DIR;
      const logDir = path.join(varDir, 'log');

      assert.strictEqual(Dirs.theOne.LOG_DIR, logDir);
      assert.isTrue(fs.existsSync(logDir));
    });
  });

  describe('.SERVER_DIR', () => {
    it('is a known subdirectory off of `BASE_DIR`', () => {
      const baseDir = Dirs.theOne.BASE_DIR;
      const serverDir = path.join(baseDir, 'server');

      assert.strictEqual(Dirs.theOne.SERVER_DIR, serverDir);
      assert.isTrue(fs.existsSync(serverDir));
    });
  });

  describe('.VAR_DIR', () => {
    it('returns a known subdirectory off of `BASE_DIR`', () => {
      const baseDir = Dirs.theOne.BASE_DIR;
      const varDir = path.join(baseDir, 'var');

      assert.strictEqual(Dirs.theOne.VAR_DIR, varDir);
      assert.isTrue(fs.existsSync(varDir));
    });
  });
});
