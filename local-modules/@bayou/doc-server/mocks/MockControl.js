// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DurableControl } from '@bayou/doc-server';
import { MockSnapshot } from '@bayou/ot-common/mocks';

/**
 * Subclass of {@link DurableControl} for use in testing.
 */
export class MockControl extends DurableControl {
  constructor(fileAccess, logLabel) {
    super(fileAccess, logLabel);

    this.revNum = 0;
  }

  _impl_getSnapshot(revNum, timeoutMsec_unused) {
    return new MockSnapshot(revNum, [['snap', revNum]]);
  }

  _impl_validateChange() {
    return true;
  }

  static get _impl_pathPrefix() {
    return '/mock_control';
  }

  static get _impl_snapshotClass() {
    return MockSnapshot;
  }
}
