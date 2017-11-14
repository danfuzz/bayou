// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TObject, TString } from 'typecheck';
import { ColorUtil, CommonBase, Errors } from 'util-common';

import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import RevisionNumber from './RevisionNumber';
import Timestamp from './Timestamp';

/**
 * {Map<string, function>} Map from each allowed caret field name to a type
 * checker predicate for same.
 *
 * **Note:** `sessionId` is not included, because that's separate from the
 * caret's "fields" per se.
 */
const CARET_FIELDS = new Map([
  ['lastActive', Timestamp.check],
  ['revNum',     RevisionNumber.check],
  ['index',      TInt.nonNegative],
  ['length',     TInt.nonNegative],
  ['color',      ColorUtil.checkCss]
]);

/**
 * {Caret|null} An instance with all default values. Initialized in the static
 * method of the same name.
 */
let DEFAULT = null;

/**
 * Information about the state of a single document editing session. Instances
 * of this class are always frozen (immutable).
 *
 * **Note:** The use of the term "caret" in this and other classes, method
 * names, and the like, is meant to be a synecdochal metaphor for all
 * information about a session, including the human driving it. The caret per
 * se is merely the most blatant aspect of it.
 */
export default class Caret extends CommonBase {
  /** {Caret} An instance with all default values. */
  static get DEFAULT() {
    if (DEFAULT === null) {
      DEFAULT = new Caret('no_session',
        {
          lastActive: Timestamp.now(),
          revNum:     0,
          index:      0,
          length:     0,
          color:      '#000000'
        });
    }

    return DEFAULT;
  }

  /**
   * Checks a potential value for an instance field. This throws an error if
   * the field name is invalid or the value is not valid for the named field.
   *
   * @param {string} name Field name.
   * @param {*} value Potential value for the named field.
   * @returns {*} `value` if it is valid.
   */
  static checkField(name, value) {
    TString.check(name);

    const checker = CARET_FIELDS.get(name);

    if (!checker) {
      throw Errors.bad_value(name, 'caret field name');
    }

    try {
      checker(value);
    } catch (e) {
      // Higher-fidelity error.
      throw Errors.bad_value(value, `${name} field value`);
    }

    return value;
  }

  /**
   * Constructs an instance. Only the first argument (`sessionIdOrBase`) is
   * required, and it is not necessary to specify all the fields in `fields`.
   * Fields not listed are derived from the base caret (first argument) if
   * specified as such, or from the default value `Caret.DEFAULT` if the first
   * argument is a session ID.
   *
   * @param {string|Caret} sessionIdOrBase Session ID that identifies the caret,
   *   or a base caret instance which provides the session and default values
   *   for fields.
   * @param {object} [fields = {}] Fields of the caret, as plain object mapping
   *   field names to values.
   */
  constructor(sessionIdOrBase, fields = {}) {
    let sessionId;
    let newFields;

    if (sessionIdOrBase instanceof Caret) {
      newFields = new Map(sessionIdOrBase._fields);
      sessionId = sessionIdOrBase.sessionId;
    } else {
      newFields = DEFAULT ? new Map(DEFAULT._fields) : new Map();
      sessionId = TString.nonEmpty(sessionIdOrBase);
    }

    TObject.plain(fields);

    super();

    /** {string} The session ID. */
    this._sessionId = sessionId;

    /** {Map<string,*>} Map of all of the caret fields, from name to value. */
    this._fields = newFields;

    for (const [k, v] of Object.entries(fields)) {
      newFields.set(k, Caret.checkField(k, v));
    }

    if (DEFAULT && (newFields.size !== DEFAULT._fields.size)) {
      throw Errors.bad_use(`Missing field.`);
    }

    Object.freeze(this);
  }

  /**
   * {string} The color to be used when annotating this selection. It is in CSS
   * three-byte hex format (e.g. `'#ffeab9'`).
   */
  get color() {
    return this._fields.get('color');
  }

  /**
   * {Int} The zero-based leading position of this caret / selection.
   */
  get index() {
    return this._fields.get('index');
  }

  /**
   * {Timestamp} The moment in time when this session was last active.
   */
  get lastActive() {
    return this._fields.get('lastActive');
  }

  /**
   * {Int} The length of the selection, or zero if it is just an insertion
   * point.
   */
  get length() {
    return this._fields.get('length');
  }

  /**
   * {Int} Document revision number which the instances position / selection is
   * with respect to.
   */
  get revNum() {
    return this._fields.get('revNum');
  }

  /**
   * {string} Opaque reference to be used with other APIs to get information
   * about the author whose caret this is.
   */
  get sessionId() {
    return this._sessionId;
  }

  /**
   * Composes the given `delta` on top of this instance, producing a new
   * instance. The operations in `delta` must all be `setField` ops for the same
   * `sessionId` as this instance.
   *
   * @param {CaretDelta} delta Delta to apply.
   * @returns {Caret} Caret consisting of this instance's data as the base, with
   *   `delta`'s updates applied.
   */
  compose(delta) {
    CaretDelta.check(delta);

    const fields = {};

    for (const op of delta.ops) {
      const props = op.props;
      if (props.opName !== CaretOp.SET_FIELD) {
        throw Errors.bad_use(`Invalid operation name: ${props.opName}`);
      } else if (props.sessionId !== this.sessionId) {
        throw Errors.bad_use('Mismatched session ID.');
      }

      fields[props.key] = props.value;
    }

    return new Caret(this, fields);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    // Convert the `_fields` map to a plain object for the purpose of coding.
    const fields = {};
    for (const [k, v] of this._fields) {
      fields[k] = v;
    }

    return [this._sessionId, fields];
  }

  /**
   * Calculates the difference from a given caret to this one. The return
   * value is a delta which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerCaret ==
   * this.compose(this.diff(newerCaret), true)`.
   *
   * **Note:** The word `newer` in the argument name is meant to be suggestive
   * of typical usage of this method, but there is no actual requirement that
   * the argument be strictly newer in any sense, compared to the instance this
   * method is called on.
   *
   * @param {Caret} newerCaret Caret to take the difference from. It must have
   *   the same `sessionId` as this instance.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerCaret` and this instance.
   */
  diff(newerCaret) {
    Caret.check(newerCaret);

    const sessionId = this.sessionId;

    if (sessionId !== newerCaret.sessionId) {
      throw Errors.bad_use('Cannot `diff` carets with mismatched `sessionId`.');
    }

    return this.diffFields(newerCaret, sessionId);
  }

  /**
   * Like `diff()`, except does _not_ check to see if the two instances'
   * `sessionId`s match. That is, it only looks at the fields.
   *
   * @param {Caret} newerCaret Caret to take the difference from.
   * @param {string} sessionId Session ID to use for the ops in the result.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerCaret` and this instance, _not_ including any difference in
   *   `sessionId`, if any.
   */
  diffFields(newerCaret, sessionId) {
    Caret.check(newerCaret);
    TString.nonEmpty(sessionId);

    const fields = this._fields;
    const ops    = [];

    for (const [k, v] of newerCaret._fields) {
      if (!Caret._equalFields(v, fields.get(k))) {
        ops.push(CaretOp.op_setField(sessionId, k, v));
      }
    }

    return new CaretDelta(ops);
  }

  /**
   * Compares this to another value, for equality.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof Caret)) {
      return false;
    }

    if (this._sessionId !== other._sessionId) {
      return false;
    }

    const fields = this._fields;
    for (const [k, v] of other._fields) {
      if (!Caret._equalFields(v, fields.get(k))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper for `diff()` and `equals()` which compares two corresponding fields
   * for equality.
   *
   * @param {*} v1 Value to compare.
   * @param {*} v2 Value to compare.
   * @returns {boolean} `true` iff they should be considered equal.
   */
  static _equalFields(v1, v2) {
    if (v1 === v2) {
      return true;
    }

    // For non-primitive values, both must be objects of the same class to be
    // considered equal. And that class must define an `equals()` method.

    const t1 = typeof v1;
    const t2 = typeof v2;

    if (   ((t1 !== 'object') || (t2 !== 'object'))
        || (v1.constructor !== v2.constructor)
        || !v1.equals) {
      return false;
    }

    return v1.equals(v2);
  }
}

// Ensure that `DEFAULT` is initialized.
Caret.DEFAULT;
