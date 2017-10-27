// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import DocSession from './DocSession';

/**
 * Plumbing between the title field (managed by Quill) on the client and the
 * document model (specifically a `title` property) on the server.
 */
export default class TitleClient extends CommonBase {
  /**
   * Constructs an instance. The constructed instance expects to be the primary
   * non-human controller of the Quill instance it manages.
   *
   * @param {QuillProm} quill Quill editor instance for the title.
   * @param {DocSession} docSession Server session control / manager.
   */
  constructor(quill, docSession) {
    super();

    /** {Quill} Editor object. */
    this._quill = quill;

    /** {DocSession} Server session control / manager. */
    this._docSession = DocSession.check(docSession);

    /** {Logger} Logger specific to this client's session. */
    this._log = docSession.log;

    /** {PropertyClient} Property data communication handler. */
    this._propertyClient = docSession.propertyClient;
  }

  /**
   * Starts handling bidirectional updates.
   */
  start() {
    // **TODO:** Needs to be implemented.
  }
}
