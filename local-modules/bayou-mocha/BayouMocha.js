// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Mocha from 'mocha';
import fs from 'fs';
import path from 'path';

const mocha = new Mocha();
const testDir = 'test';

export default class BayouMocha {
  static runAllTests() {
    const allFiles = fs.readdirSync(testDir);
    const jsFiles = allFiles.filter(file => file.substr(-3) === '.js');

    jsFiles.forEach(file => {
      mocha.addFile(path.join(testDir, file));
    });

    mocha.run(failures => {
      process.on('exit', () => process.exit(failures));
    });
  }
}
