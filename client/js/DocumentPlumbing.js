// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Plumbing between Quill on the client and the document model on the server.
 */
export default class DocumentPlumbing {
  /**
   * Constructs an instance. As a side effect, sets up the linkage between
   * the two entities in question. Assuming the network is up, soon after
   * construction the first version of the doc will get sent to the client.
   *
   * @param `quill` Quill editor instance.
   * @param `api` `ApiClient` instance.
   */
  constructor(quill, api) {
    this._quill = quill;
    this._api = api;

    quill.on('text-change', this.handleTextChange.bind(this));

    // Get the initial document state from the server.
    api.snapshot().then(
      (result) => {
        const version = result.version; // TODO: Something useful with this.
        quill.setContents(result.data, 'api');
      },
      (error) => {
        throw new Error(error);
      }
    );
  }

  /**
   * Handles a `text-change` event coming from Quill. **Note:** `oldDelta` is a
   * representation of the whole document, not just the previous change.
   */
  handleTextChange(delta, oldDelta, source) {
    if (source !== 'user') {
      return;
    }
    this._api.update(delta);
  }
};
