// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber, Timestamp } from '@bayou/ot-common';
import { TInt, TObject, TString } from '@bayou/typecheck';
import { ColorUtil, CommonBase, Errors } from '@bayou/util-common';

import { CaretDelta } from './CaretDelta';
import { CaretId } from './CaretId';
import { CaretOp } from './CaretOp';

/**
 * {Map<string, function>} Map from each allowed caret field name to a type
 * checker predicate for same.
 *
 * **Note:** The caret's ID is not included, because that's separate from the
 * caret's "fields" per se.
 *
 * **Note:** We use the `bind(...)` form for method binding instead of an
 * anonymous function because the latter &mdash; while more standard &mdash;
 * confuses the linter.
 */
const CARET_FIELDS = new Map([
  ['authorId',   TString.check.bind(TString)],
  ['color',      ColorUtil.checkCss],
  ['index',      TInt.nonNegative],
  ['lastActive', Timestamp.check.bind(Timestamp)],
  ['length',     TInt.nonNegative],
  ['revNum',     RevisionNumber.check]
]);

/**
 * {string} Special value for the ID which is only allowed for the default
 * caret.
 */
const DEFAULT_ID = '<no_id>';

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
 * information about a session from the user's perspective, including the human
 * driving it. The caret per se is merely the most blatant aspect of it.
 */
export class Caret extends CommonBase {
  /** {Caret} An instance with all default values. */
  static get DEFAULT() {
    if (DEFAULT === null) {
      // **Note:** There is no default for `authorId`, which is what makes it
      // end up getting required when constructing a new instance from scratch.
      DEFAULT = new Caret(DEFAULT_ID,
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
      throw Errors.badValue(name, 'caret field name');
    }

    try {
      checker(value);
    } catch (e) {
      // Higher-fidelity error.
      throw Errors.badValue(value, `${name} field value`);
    }

    return value;
  }

  /**
   * Constructs an instance. Only the first argument (`idOrBase`) is required,
   * and it is not necessary to specify all the fields in `fields`. Fields not
   * listed are derived from the base caret (first argument) if specified as
   * such, or from the default value {@link #DEFAULT} if the first argument is
   * an ID.
   *
   * **Note:** {@link #DEFAULT} does not bind an `authorId`, which means that
   * that field must be specified when creating an instance "from scratch."
   *
   * @param {string|Caret} idOrBase Caret ID, or a base caret instance which
   *   provides the ID and default values for fields.
   * @param {object} [fields = {}] Fields of the caret, as plain object mapping
   *   field names to values.
   */
  constructor(idOrBase, fields = {}) {
    let id;
    let newFields;

    if (idOrBase instanceof Caret) {
      newFields = new Map(idOrBase._fields);
      id = idOrBase.id;
    } else if (DEFAULT !== null) {
      newFields = new Map(DEFAULT._fields);
      id = CaretId.check(idOrBase);
    } else {
      // If we're here, it means that `DEFAULT` is currently being initialized.
      newFields = new Map();
      id = TString.check(idOrBase);
    }

    TObject.plain(fields);

    super();

    /** {string} The caret ID. */
    this._id = id;

    /** {Map<string,*>} Map of all of the caret fields, from name to value. */
    this._fields = newFields;

    for (const [k, v] of Object.entries(fields)) {
      newFields.set(k, Caret.checkField(k, v));
    }

    if (DEFAULT && (newFields.size !== CARET_FIELDS.size)) {
      throw Errors.badUse(`Missing field.`);
    }

    Object.freeze(this);
  }

  /**
   * {string} ID of the author responsible for this caret.
   */
  get authorId() {
    return this._fields.get('authorId');
  }

  /**
   * {string} The color to be used when annotating this selection. It is in CSS
   * three-byte hex format (e.g. `'#ffeab9'`).
   */
  get color() {
    return this._fields.get('color');
  }

  /**
   * {string} ID of the caret. This uniquely identifies this caret within the
   * context of a specific document.
   */
  get id() {
    return this._id;
  }

  /**
   * {Int} The zero-based leading position of this caret / selection.
   */
  get index() {
    return this._fields.get('index');
  }

  /**
   * {Timestamp} The moment in time when this caret was last active.
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
   * Composes the given `delta` on top of this instance, producing a new
   * instance. The operations in `delta` must all be `setField` ops for the same
   * `id` as this instance.
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
      if (props.opName !== CaretOp.CODE_setField) {
        throw Errors.badUse(`Invalid operation name: ${props.opName}`);
      } else if (props.caretId !== this.id) {
        throw Errors.badUse('Mismatched ID.');
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

    return [this._id, fields];
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
   *   the same `id` as this instance.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerCaret` and this instance.
   */
  diff(newerCaret) {
    Caret.check(newerCaret);

    const id = this.id;

    if (id !== newerCaret.id) {
      throw Errors.badUse('Cannot `diff` carets with mismatched `id`.');
    }

    return this.diffFields(newerCaret, id);
  }

  /**
   * Like `diff()`, except does _not_ check to see if the two instances' `id`s
   * match. That is, it only looks at the fields.
   *
   * @param {Caret} newerCaret Caret to take the difference from.
   * @param {string} id ID to use for the ops in the result.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerCaret` and this instance, _not_ including any difference in
   *   `id`, if any.
   */
  diffFields(newerCaret, id) {
    Caret.check(newerCaret);
    CaretId.check(id);

    const fields = this._fields;
    const ops    = [];

    for (const [k, v] of newerCaret._fields) {
      if (!Caret._equalFields(v, fields.get(k))) {
        ops.push(CaretOp.op_setField(id, k, v));
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

    if (this._id !== other._id) {
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
