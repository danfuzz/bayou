// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TObject, TString } from 'typecheck';
import { CommonBase, DataUtil, Errors, Functor } from 'util-common';

/**
 * Operation on a text document body.
 *
 * This class is designed to bridge the two worlds of the Bayou OT framework and
 * Quill's ad-hoc-object-based deltas. As such, it defines a number of
 * properties that act as a Quill-compatible "front" for the underlying
 * operation payload, each one marked prominently to indicate that fact.
 * ***These properties should never be used directly by Bayou code.***
 */
export default class BodyOp extends CommonBase {
  /** {string} Operation name for "delete" operations. */
  static get DELETE() {
    return 'delete';
  }

  /** {string} Operation name for "insert embed" operations. */
  static get INSERT_EMBED() {
    return 'insert_embed';
  }

  /** {string} Operation name for "insert text" operations. */
  static get INSERT_TEXT() {
    return 'insert_text';
  }

  /** {string} Operation name for "retain" operations. */
  static get RETAIN() {
    return 'retain';
  }

  /**
   * Returns an instance of this class which corresponds to the given Quill
   * delta operation form.
   *
   * @param {object} quillOp Quill-style delta operation.
   * @returns {BodyOp} Corresponding instance of this class.
   */
  static fromQuillForm(quillOp) {
    const { attributes = null, delete: del, insert, retain } = quillOp;

    if (insert !== undefined) {
      if (typeof insert === 'string') {
        return BodyOp.op_insertText(insert, attributes);
      } else {
        // An "embed" is represented as a single-binding `object`, where the
        // key of the binding is the type of the embed, and the bound value is
        // an arbitrary value as defined by the type.
        const [key, value] = Object.entries(insert).next();
        return BodyOp.op_insertEmbed(new Functor(key, value));
      }
    } else if (del !== undefined) {
      return BodyOp.op_delete(del);
    } else if (retain !== undefined) {
      return BodyOp.op_retain(retain, attributes);
    } else {
      throw Errors.bad_value(quillOp, 'Quill delta operation');
    }
  }

  /**
   * Constructs a new "delete" operation.
   *
   * @param {Int} count The number of elements (characters or embeds) to delete.
   *   Must be `>= 1`.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_delete(count) {
    TInt.min(count, 1);

    return new BodyOp(new Functor(BodyOp.DELETE, count));
  }

  /**
   * Constructs a new "insert embed" operation.
   *
   * @param {Functor} value Functor representing the embed type (functor name)
   *   and construction argument (functor argument).
   * @returns {BodyOp} The corresponding operation.
   */
  static op_insertEmbed(value) {
    Functor.check(value);
    value = DataUtil.deepFreeze(value);

    return new BodyOp(new Functor(BodyOp.INSERT_EMBED, value));
  }

  /**
   * Constructs a new "insert text" operation.
   *
   * @param {string} text The text to insert. Must be non-empty.
   * @param {object|null} [attributes = null] Attributes to apply to (or
   *   associate with) the text, or `null` if there are no attributes to apply.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_insertText(text, attributes = null) {
    TString.nonEmpty(text);
    if (attributes !== null) {
      TObject.checkSimple(attributes);
    }

    return new BodyOp(new Functor(BodyOp.INSERT_TEXT, text, attributes));
  }

  /**
   * Constructs a new "retain" operation.
   *
   * @param {Int} count The number of elements (characters or embeds) to retain.
   *   Must be `>= 1`.
   * @param {object|null} [attributes = null] Attribute changes to apply to (or
   *   associate with) the retained elements, or `null` if there are no
   *   attribute changes to apply.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_retain(count, attributes = null) {
    TInt.min(count, 1);
    if (attributes !== null) {
      TObject.checkSimple(attributes);
    }

    return new BodyOp(new Functor(BodyOp.RETAIN, count, attributes));
  }

  /**
   * Constructs an instance. This should not be used directly. Instead, use
   * the static constructor methods defined by this class.
   *
   * @param {Functor} payload The operation payload (name and arguments).
   */
  constructor(payload) {
    super();

    /** {Functor} payload The operation payload (name and arguments). */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /**
   * {object|undefined} **Quill interop:** The Quill-compatible `attributes`
   * property of the operation, or `undefined` if either set to `null` or not
   * defined for this instance.
   */
  get attributes() {
    return this.props.attributes || undefined;
  }

  /**
   * {Int|undefined} **Quill interop:** The Quill-compatible `delete` property
   * of the operation, or `undefined` if not defined for this instance.
   */
  get delete() {
    const { opName, count } = this.props;

    return (opName === BodyOp.DELETE) ? count : undefined;
  }

  /**
   * {string|Int|undefined} **Quill interop:** The Quill-compatible `insert`
   * property of the operation, or `undefined` if not defined for this instance.
   */
  get insert() {
    const { opName, text, value } = this.props;

    switch (opName) {
      case BodyOp.INSERT_EMBED: {
        return { [value.name]: value.args[0] };
      }
      case BodyOp.INSERT_TEXT: {
        return text;
      }
      default: {
        return undefined;
      }
    }
  }

  /** {Functor} The operation payload (name and arguments). */
  get payload() {
    return this._payload;
  }

  /**
   * {Int|undefined} **Quill interop:** The Quill-compatible `retain` property
   * of the operation, or `undefined` if not defined for this instance.
   */
  get retain() {
    const { opName, count } = this.props;

    return (opName === BodyOp.RETAIN) ? count : undefined;
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * simple object. `opName` is always bound to the operation name. Other
   * bindings depend on the operation name. Guaranteed to be an immutable
   * object.
   */
  get props() {
    const payload = this._payload;
    const opName  = payload.name;

    switch (opName) {
      case BodyOp.DELETE: {
        const [count] = payload.args;
        return Object.freeze({ opName, count });
      }

      case BodyOp.INSERT_EMBED: {
        const [value] = payload.args;
        return Object.freeze({ opName, value });
      }

      case BodyOp.INSERT_TEXT: {
        const [text, attributes] = payload.args;
        return Object.freeze({ opName, text, attributes });
      }

      case BodyOp.RETAIN: {
        const [count, attributes] = payload.args;
        return Object.freeze({ opName, count, attributes });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Compares this to another possible-instance, for equality of content.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof BodyOp)) {
      return false;
    }

    return this._payload.equals(other._payload);
  }

  /**
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._payload];
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    return `${this.constructor.name} { ${this._payload} }`;
  }
}
