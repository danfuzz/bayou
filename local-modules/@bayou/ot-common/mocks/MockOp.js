// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';

/**
 * Mock operation class for testing.
 */
export class MockOp extends BaseOp {
  static get CODE_composedDoc()    { return 'composedDoc';    }
  static get CODE_composedNotDoc() { return 'composedNotDoc'; }
  static get CODE_diffDelta()      { return 'diffDelta';      }
  static get CODE_notDocument()    { return 'notDocument';    }
  static get CODE_snap()           { return 'snap';           }
  static get CODE_x()              { return 'x';              }
  static get CODE_y()              { return 'y';              }
  static get CODE_yes()            { return 'yes';            }
  static get CODE_z()              { return 'z';              }

  get name() {
    return this.payload.name;
  }

  get arg0() {
    return this.payload.args[0];
  }

  static _impl_isValidPayload() {
    return true;
  }
}
