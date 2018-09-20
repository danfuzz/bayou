// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';

/**
 * Mock operation class for testing.
 */
export default class MockOp extends BaseOp {
  static get CODE_composedDoc()    { return 'composedDoc';    }
  static get CODE_composedDoc_()   { return 'composedDoc_';   }
  static get CODE_composedDoc__()  { return 'composedDoc__';  }
  static get CODE_composedNotDoc() { return 'composedNotDoc'; }
  static get CODE_notDocument()    { return 'notDocument';    }
  static get CODE_x()              { return 'x';              }
  static get CODE_y()              { return 'y';              }
  static get CODE_yes()            { return 'yes';            }

  get name() {
    return this.payload.name;
  }

  static _impl_isValidPayload() {
    return true;
  }
}
