// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';

import BaseSnapshot from './BaseSnapshot';
import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';


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
   * Composes a change on top of this instance, to produce a new instance.
   *
   * @param {BodyChange} change Change to compose on top of this instance.
   * @returns {BodySnapshot} New instance consisting of the composition of
   *   this instance with `change`.
   */
  compose(change) {
    BodyChange.check(change);

    const contents = change.delta.isEmpty()
      ? this.contents
      : BodyDelta.coerce(this.contents.compose(change.delta));

    return new BodySnapshot(change.revNum, contents);
  }

  /**
   * Composes a sequence of changes on top of this instance, in order, to
   * produce a new instance.
   *
   * @param {array<BodyChange>} changes Changes to compose on top of this
   *   instance.
   * @returns {BodySnapshot} New instance consisting of the composition of
   *   this instance with all of the `changes`.
   */
  composeAll(changes) {
    TArray.check(changes, BodyChange.check);

    if (changes.length === 0) {
      return this;
    }

    let contents = this.contents;
    for (const c of changes) {
      contents = contents.compose(c.delta);
    }

    const lastChange = changes[changes.length - 1];
    return new BodySnapshot(lastChange.revNum, contents);
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a change which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerSnapshot ==
   * this.compose(this.diff(newerSnapshot))`.
   *
   * @param {BodySnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {BodyChange} Change which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  diff(newerSnapshot) {
    BodySnapshot.check(newerSnapshot);

    const oldContents = this.contents;
    const newContents = newerSnapshot.contents;
    const delta       = BodyDelta.coerce(oldContents.diff(newContents));

    return new BodyChange(newerSnapshot.revNum, delta);
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return BodyChange;
  }
}
