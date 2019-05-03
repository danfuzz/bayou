// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

// These classes aren't exported publicly, so they need to be imported by path.
import { ConfigMap } from '@bayou/injecty/ConfigMap';
import { UseHandler } from '@bayou/injecty/UseHandler';

// **Note:** These tests all use proxy instances in the way expected of clients
// of this module.
describe('@bayou/injecty/UseHandler', () => {
  it('retrieves configurations from a `ConfigMap` instance', () => {
    const cm  = new ConfigMap();
    const use = UseHandler.makeProxy(cm);

    cm.add('foo', 'FOO');
    cm.add('bar', 'BAR');

    assert.strictEqual(use.foo, 'FOO');
    assert.strictEqual(use.bar, 'BAR');
  });
});
