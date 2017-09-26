// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
import { CommonBase, Errors } from 'util-common';

import BodyChange from './BodyChange';
import BodyDelta from './BodyDelta';
import RevisionNumber from './RevisionNumber';


/**
 * {BodySnapshot|null} Empty instance. Initialized in the `EMPTY` property
 * accessor.
 */
let emptyInstance = null;

/**
 * Snapshot of document contents, with other associated information.
 */
export default class BodySnapshot extends CommonBase {
  /**
   * {BodySnapshot} Empty instance of this class. It has an empty delta and
   * revision number `0`.
   */
  static get EMPTY() {
    if (emptyInstance === null) {
      emptyInstance = new BodySnapshot(0, BodyDelta.EMPTY);
    }

    return emptyInstance;
  }

  /**
   * Constructs an instance.
   *
   * @param {RevisionNumber} revNum Revision number of the document.
   * @param {Delta|array|object} contents Document contents. Can be given
   *   anything that can be coerced into a `BodyDelta`. Must be a "document"
   *   (that is, a delta consisting only of `insert` operations).
   */
  constructor(revNum, contents) {
    super();

    /** {Int} Revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {BodyDelta} Document contents. */
    this._contents = BodyDelta.coerce(contents);

    // Explicitly check that the `contents` delta has the form of a "document,"
    // that is, the only operations are `insert`s. For very large documents,
    // this might turn out to be a prohibitively slow operation, so...
    //
    // **TODO:** Evaluate how expensive this is in practice, and figure out a
    // better tactic if need be.
    //
    // **TODO:** There is more to being valid than just being `isDocument()`,
    // i.e. the ops themselves have to be valid in the contents of this project.
    // That validity should also be enforced.
    if (!this._contents.isDocument()) {
      throw Errors.bad_value(contents, 'document delta');
    }

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._contents];
  }

  /** {RevisionNumber} The revision number. */
  get revNum() {
    return this._revNum;
  }

  /** {BodyDelta} The document contents. */
  get contents() {
    return this._contents;
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
      ? this._contents
      : BodyDelta.coerce(this._contents.compose(change.delta));

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

    let contents = this._contents;
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
}
