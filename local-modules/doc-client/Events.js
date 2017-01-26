// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Constructors for the events used by the client synching state machine.
 *
 * **Note:** This class serves as documentation for each of the kinds of events
 * used by the system.
 */
export default class Events {
  /**
   * Constructs an `apiError` event. This indicates that an error was reported
   * back from an API call.
   *
   * @param {string} method Name of the method that was called.
   * @param {string} reason Error reason.
   * @returns {object} The constructed event.
   */
  static apiError(method, reason) {
    return {name: 'apiError', method, reason};
  }

  /**
   * Constructs a `gotApplyDelta` event. This represents a successful result
   * from the API call `applyDelta()`. Keys are as defined by that API, with
   * the addition of `expectedContents` which represents the expected result of
   * merge (which will be the case if there are no other intervening changes).
   *
   * @param {Delta} expectedContents The expected result of the merge. This
   *   will be the actual result if there are no other intervening changes
   *   (indicated by the fact that `delta` is empty).
   * @param {number} verNum The version number of the resulting document.
   * @param {object} delta The delta from `expectedContents`.
   * @returns {object} The constructed event.
   */
  static gotApplyDelta(expectedContents, verNum, delta) {
    return {name: 'gotApplyDelta', expectedContents, verNum, delta};
  }

  /**
   * Constructs a `gotDeltaAfter` event. This represents a successful result
   * from the API call `deltaAfter()`. Keys are as defined by that API, with
   * the addition of `baseDoc` which represents the document at the time of the
   * request.
   *
   * @param {Snapshot} baseDoc The document at the time of the original request.
   * @param {number} verNum The version number of the document.
   * @param {Delta} delta The delta from `baseDoc`.
   * @returns {object} The constructed event.
   */
  static gotDeltaAfter(baseDoc, verNum, delta) {
    return {name: 'gotDeltaAfter', baseDoc, verNum, delta};
  }

  /**
   * Constructs a `gotLocalDelta` event. This indicates that there is at least
   * one local change that Quill has made to its document which is not yet
   * reflected in the given base document. Put another way, this indicates that
   * `_currentChange` has a resolved `next`.
   *
   * @param {Snapshot} baseDoc The document at the time of the original request.
   * @returns {object} The constructed event.
   */
  static gotLocalDelta(baseDoc) {
    return {name: 'gotLocalDelta', baseDoc};
  }

  /**
   * Constructs a `gotSnapshot` event. This represents a successful result from
   * the API call `snapshot()`. Keys are as defined by that API.
   *
   * @param {Snapshot} snapshot The snapshot.
   * @returns {object} The constructed event.
   */
  static gotSnapshot(snapshot) {
    return {name: 'gotSnapshot', snapshot};
  }

  /**
   * Constructs a `start` event. This is the event that kicks off the client.
   *
   * @returns {object} The constructed event.
   */
  static start() {
    return {name: 'start'};
  }

  /**
   * Constructs a `wantApplyDelta` event. This indicates that it is time to
   * send collected local changes up to the server.
   *
   * @param {Snapshot} baseDoc The document at the time of the original request.
   * @returns {object} The constructed event.
   */
  static wantApplyDelta(baseDoc) {
    return {name: 'wantApplyDelta', baseDoc};
  }

  /**
   * Constructs a `wantChanges` event. This indicates that it is time to
   * request a new change from the server, but only if the client isn't in the
   * middle of doing something else.
   *
   * @returns {object} The constructed event.
   */
  static wantChanges() {
    return {name: 'wantChanges'};
  }
}
