// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';

import BodyChange from './BodyChange';


/**
 * Snapshot of main document body contents.
 */
export default class BodySnapshot extends BaseSnapshot {
  /**
   * Constructs an instance.
   *
   * @param {RevisionNumber} revNum Revision number of the document.
   * @param {object|array} contents The document contents per se, in the form of
   *   a document delta (that is, a from-empty delta). This must be either a
   *   `BodyDelta` or an array which can be passed to the `BodyDelta`
   *   constructor to produce a valid delta.
   */
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  /**
   * Main implementation of {@link #diff}, which produces a delta (not a
   * change).
   *
   * @param {BodySnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {BodyDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  _impl_diffAsDelta(newerSnapshot) {
    const oldContents = this.contents;
    const newContents = newerSnapshot.contents;

    return oldContents.diff(newContents);
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return BodyChange;
  }
}
