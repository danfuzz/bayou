// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak-napi';

import { TInt, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Entry for the weak-cache portion of a {@link BaseCache} instance.
 */
export class WeakCacheEntry extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} createTimeMsec The time (Unix Epoch msec) when this entry was
   *   created.
   * @param {string} id The entry ID.
   * @param {Weak|Promise|Error} value The entry value.
   */
  constructor(createTimeMsec, id, value) {
    super();

    /** {Int} The time (Unix Epoch msec) when this entry was created. */
    this._createTimeMsec = TInt.nonNegative(createTimeMsec);

    /** {string} The entry ID. */
    this._id = TString.check(id);

    let kind;
    if (value instanceof Promise) {
      kind = 'promise';
    } else if (value instanceof Error) {
      kind = 'error';
    } else if (weak.isWeakRef(value)) {
      kind = 'weak';
    } else {
      throw Errors.badValue(value, 'Weak|Promise');
    }

    /** {Weak|null} The entry value, if it is a weak reference. */
    this._weak = (kind === 'weak') ? value : null;

    /** {Promise|null} The entry value, if it is a promise. */
    this._promise = (kind === 'promise') ? value : null;

    /** {Error|null} The entry value, if it is an error. */
    this._error = (kind === 'error') ? value : null;

    Object.freeze(this);
  }

  /** {Int} The time (Unix Epoch msec) when this entry was created. */
  get createTimeMsec() {
    return this._createTimeMsec;
  }

  /** {Error|null} The entry value, if it is an error. */
  get error() {
    return this._error;
  }

  /** {string} The entry ID. */
  get id() {
    return this._id;
  }

  /**
   * {object|null} A strong reference to the (otherwise) weakly-held value, if
   * this entry is a weak reference whose referent is alive.
   */
  get object() {
    if (this._weak === null) {
      return null;
    }

    const result = weak.get(this._weak);

    return (result === undefined) ? null : result;
  }

  /** {Promise|null} The entry value, if it is a promise. */
  get promise() {
    return this._promise;
  }

  /** {Weak|null} The entry value, if it is a weak reference. */
  get weak() {
    return this._weak;
  }
}
