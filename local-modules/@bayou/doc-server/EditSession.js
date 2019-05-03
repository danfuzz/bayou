// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, PropertyChange } from '@bayou/doc-common';
import { RevisionNumber, Timestamp } from '@bayou/ot-common';

import { ViewSession } from './ViewSession';

/**
 * Server side representative of a session which allows editing.
 *
 * See header comment on superclass {@link ViewSession} for a salient design
 * note.
 */
export class EditSession extends ViewSession {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex representing the underlying
   *   file for this instance to use.
   * @param {string} authorId The author this instance acts on behalf of.
   * @param {string} caretId Caret ID for this instance.
   */
  constructor(fileComplex, authorId, caretId) {
    super(fileComplex, authorId, caretId);

    Object.freeze(this);
  }

  /**
   * Applies an update to the document body, assigning authorship of the change
   * to the author represented by this instance and a timestamp which is
   * approximately the current time. See {@link BodyControl#update} for details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {BodyDelta} delta List of operations indicating what has changed
   *   with respect to `baseRevNum`.
   * @returns {BodyChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the document.
   */
  async body_update(baseRevNum, delta) {
    RevisionNumber.check(baseRevNum);

    // **Note:** The change instance gets `baseRevNum + 1` because that's what
    // revision would result if the `delta` were able to be applied directly. If
    // we get "lucky" (win any races) that will be the actual revision number,
    // but the ultimate result might have a higher `revNum`.
    const change           = new BodyChange(baseRevNum + 1, delta, Timestamp.now(), this._authorId);
    const bodyChangeResult = await this._bodyControl.update(change);
    const documentId       = this.getDocumentId();

    this._bodyControl.queueHtmlExport(bodyChangeResult.revNum, documentId);

    return bodyChangeResult;
  }
  static get _loggingFor_body_update() {
    return {
      args: [true, false],
      result: false
    };
  }

  /**
   * Applies an update to the properties (document metadata), assigning
   * authorship of the change to the author represented by this instance and a
   * timestamp which is approximately the current time. See
   * {@link PropertyControl#update} for details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {PropertyDelta} delta List of operations indicating what has changed
   *   with respect to `baseRevNum`.
   * @returns {PropertyChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the document.
   */
  async property_update(baseRevNum, delta) {
    RevisionNumber.check(baseRevNum);

    // **Note:** The change instance gets `baseRevNum + 1` because that's what
    // revision would result if the `delta` were able to be applied directly. If
    // we get "lucky" (win any races) that will be the actual revision number,
    // but the ultimate result might have a higher `revNum`.
    const change = new PropertyChange(baseRevNum + 1, delta, Timestamp.now(), this._authorId);

    return this._propertyControl.update(change);
  }
  static get _loggingFor_property_update() {
    return {
      args: [true, false],
      result: false
    };
  }

  /**
   * Subclass-specific implementation which underlies {@link #canEdit}.
   *
   * @returns {boolean} `true`, always.
   */
  _impl_canEdit() {
    return true;
  }
}
