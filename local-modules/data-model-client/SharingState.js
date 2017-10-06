// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

const SHARING_STATE_EVERYONE = 'sharing-state-everyone';
const SHARING_STATE_UNKNOWN = 'sharing-state-unknown';

/**
 * A class wrapper to provide static/const getters for the values
 * indicating the sharing status of the current document.
 */
export default class SharingState {
  /**
   * {string} A sharing state indicating the document is visible to all
   *   users in the workspace.
   */
  static get EVERYONE() {
    return SHARING_STATE_EVERYONE;
  }

  /**
   * {string} A sharing state indicating that the state is unknown.
   */
  static get UNKNOWN() {
    return SHARING_STATE_UNKNOWN;
  }
}
