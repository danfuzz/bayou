// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import fs from 'fs';
import path from 'path';

import { Dirs } from 'server-env';

// See comment below for why this is commented out.
//import { PidFile } from 'server-env';

describe('server-env/PidFile', () => {
  describe('init(basePath)', () => {
    it('should create a pid.txt file at a known position off of baseDir', () => {
      // TODO: We have a small problem here in that the test runner is launched by
      // the server and the server startup calls PidFile.init(dir) and that call can't
      // be made more than once. So we are doing kind of a bad testing thing and using
      // intimate knowledge of how PidFile works rather than relying on documented
      // API behavior.
      //PidFile.init(Dirs.BASE_DIR);

      const varDir = Dirs.VAR_DIR;
      const pidFilePath = path.join(varDir, 'pid.txt');

      assert.isTrue(fs.existsSync(pidFilePath));
    });

    it('should rm the pid.txt file when the process exits');
  });
});
