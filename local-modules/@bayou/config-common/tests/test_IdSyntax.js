// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseIdSyntax, IdSyntax } from '@bayou/config-common';

describe('@bayou/config-server/IdSyntax', () => {
  it('inherits from `BaseIdSyntax`', () => {
    assert.isTrue(IdSyntax.prototype instanceof BaseIdSyntax);
  });
});
