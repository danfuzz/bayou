// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TObject, TString } from 'typecheck';
import { DataUtil, Errors, Functor, ObjectUtil } from 'util-common';

import BaseOp from './BaseOp';

/**
 * Operation on a text document body.
 *
 * This class is designed to bridge the two worlds of the Bayou OT framework and
 * Quill's ad-hoc-object-based deltas. As such, it defines a static method
 * `fromQuillForm()` and an instance method `toQuillForm()` to convert back and
 * forth as needed.
 */
export default class BodyOp extends BaseOp {
  /** {string} Operation name for "delete" operations. */
  static get DELETE() {
    return 'delete';
  }

  /**
   * {string} Operation name for "embed" (insert / append embedded object)
   * operations.
   */
  static get EMBED() {
    return 'embed';
  }

  /** {string} Operation name for "retain" operations. */
  static get RETAIN() {
    return 'retain';
  }

  /** {string} Operation name for "text" (insert / append text) operations. */
  static get TEXT() {
    return 'text';
  }

  /**
   * Returns an instance of this class which corresponds to the given Quill
   * delta operation form.
   *
   * @param {object} quillOp Quill-style delta operation.
   * @returns {BodyOp} Corresponding instance of this class.
   */
  static fromQuillForm(quillOp) {
    try {
      TObject.plain(quillOp);
    } catch (e) {
      // More specific error.
      throw Errors.bad_value(quillOp, 'Quill delta operation');
    }

    const { attributes = null, delete: del, insert, retain } = quillOp;

    const allowedSize = (attributes === null) ? 1 : 2;
    if (Object.entries(quillOp).length !== allowedSize) {
      // Extra bindings, of some sort.
      throw Errors.bad_value(quillOp, 'Quill delta operation');
    }

    if (insert !== undefined) {
      if (typeof insert === 'string') {
        return BodyOp.op_insertText(insert, attributes);
      } else if (ObjectUtil.isPlain(insert)) {
        // An "embed" is represented as a single-binding plain object, where the
        // key of the binding is the type of the embed, and the bound value is
        // an arbitrary value as defined by the type.
        const [[key, value], ...rest] = Object.entries(insert);
        if (rest.length !== 0) {
          // Invalid form for an embed.
          throw Errors.bad_value(quillOp, 'Quill delta operation');
        }
        return BodyOp.op_insertEmbed(new Functor(key, value), attributes);
      } else {
        // Neither in text nor embed form.
        throw Errors.bad_value(quillOp, 'Quill delta operation');
      }
    } else if (del !== undefined) {
      if (attributes !== null) {
        // Deletes can't have attributes.
        throw Errors.bad_value(quillOp, 'Quill delta operation');
      }
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

    return new BodyOp(BodyOp.DELETE, count);
  }

  /**
   * Constructs a new "insert embed" operation.
   *
   * @param {Functor} value Functor representing the embed type (functor name)
   *   and construction argument (functor argument).
   * @param {object|null} [attributes = null] Attributes to apply to (or
   *   associate with) the text, or `null` if there are no attributes to apply.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_insertEmbed(value, attributes = null) {
    value           = DataUtil.deepFreeze(Functor.check(value));
    const attribArg = BodyOp._attributesArg(attributes);

    return new BodyOp(BodyOp.EMBED, value, ...attribArg);
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
    const attribArg = BodyOp._attributesArg(attributes);

    return new BodyOp(BodyOp.TEXT, text, ...attribArg);
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
    const attribArg = BodyOp._attributesArg(attributes);

    return new BodyOp(BodyOp.RETAIN, count, ...attribArg);
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * plain object. `opName` is always bound to the operation name. Other
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

      case BodyOp.EMBED: {
        const [value, attributes = null] = payload.args;
        return Object.freeze({ opName, value, attributes });
      }

      case BodyOp.TEXT: {
        const [text, attributes = null] = payload.args;
        return Object.freeze({ opName, text, attributes });
      }

      case BodyOp.RETAIN: {
        const [count, attributes = null] = payload.args;
        return Object.freeze({ opName, count, attributes });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Indicates whether or not this instance is an "insert" operation of some
   * sort.
   *
   * @returns {boolean} `true` if this instance is an "insert," or `false` if
   *   not.
   */
  isInsert() {
    const opName = this._payload.name;
    return (opName === BodyOp.TEXT) || (opName === BodyOp.EMBED);
  }

  /**
   * Produces a Quill `Delta` operation (per se) with equivalent semantics to
   * this this instance.
   *
   * @returns {object} A Quill `Delta` operation with the same semantics as
   *   `this`.
   */
  toQuillForm() {
    const props = this.props;

    switch (props.opName) {
      case BodyOp.DELETE: {
        return { delete: props.count };
      }

      case BodyOp.EMBED: {
        const { value: { name, args: [arg0] }, attributes } = props;
        const insert = { [name]: arg0 };

        return attributes
          ? { insert, attributes }
          : { insert };
      }

      case BodyOp.TEXT: {
        const { text: insert, attributes } = props;

        return attributes
          ? { insert, attributes }
          : { insert };
      }

      case BodyOp.RETAIN: {
        const { count: retain, attributes } = props;

        return attributes
          ? { retain, attributes }
          : { retain };
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${props.opName}`);
      }
    }
  }

  /**
   * Converts an `attributes` argument value into an array (of zero or one
   * element), suitable for passing to the payload constructor call, including
   * deep freezing a non-`null` value (if not already deep-frozen). Throws an
   * error if invalid. In order to be valid, it must be either a plain data
   * object or `null`.
   *
   * @param {*} value The (alleged) attributes.
   * @returns {object|null} `value` if valid.
   */
  static _attributesArg(value) {
    if (value === null) {
      return [];
    }

    try {
      TObject.plain(value);
      return [DataUtil.deepFreeze(value)];
    } catch (e) {
      // More specific error.
      throw Errors.bad_value(value, 'body attributes');
    }
  }
}
