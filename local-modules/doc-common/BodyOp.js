// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from 'ot-common';
import { TInt, TObject, TString } from 'typecheck';
import { DataUtil, Errors, ObjectUtil } from 'util-common';

/**
 * Operation on a text document body.
 *
 * This class is designed to bridge the two worlds of the Bayou OT framework and
 * Quill's ad-hoc-object-based deltas. As such, it defines a static method
 * `fromQuillForm()` and an instance method `toQuillForm()` to convert back and
 * forth as needed.
 */
export default class BodyOp extends BaseOp {
  /** {string} Opcode constant for "delete" operations. */
  static get CODE_delete() {
    return 'delete';
  }

  /**
   * {string} Opcode constant for "embed" (insert / append embedded object)
   * operations.
   */
  static get CODE_embed() {
    return 'embed';
  }

  /** {string} Opcode constant for "retain" operations. */
  static get CODE_retain() {
    return 'retain';
  }

  /** {string} Opcode constant for "text" (insert / append text) operations. */
  static get CODE_text() {
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
      throw Errors.badValue(quillOp, 'Quill delta operation');
    }

    const { attributes = null, delete: del, insert, retain } = quillOp;

    const allowedSize = (attributes === null) ? 1 : 2;
    if (Object.entries(quillOp).length !== allowedSize) {
      // Extra bindings, of some sort.
      throw Errors.badValue(quillOp, 'Quill delta operation');
    }

    if (insert !== undefined) {
      if (typeof insert === 'string') {
        return BodyOp.op_text(insert, attributes);
      } else if (ObjectUtil.isPlain(insert)) {
        // An "embed" is represented as a single-binding plain object, where the
        // key of the binding is the type of the embed, and the bound value is
        // an arbitrary value as defined by the type.
        const [[key, value], ...rest] = Object.entries(insert);
        if (rest.length !== 0) {
          // Invalid form for an embed.
          throw Errors.badValue(quillOp, 'Quill delta operation');
        }
        return BodyOp.op_embed(key, value, attributes);
      } else {
        // Neither in text nor embed form.
        throw Errors.badValue(quillOp, 'Quill delta operation');
      }
    } else if (del !== undefined) {
      if (attributes !== null) {
        // Deletes can't have attributes.
        throw Errors.badValue(quillOp, 'Quill delta operation');
      }
      return BodyOp.op_delete(del);
    } else if (retain !== undefined) {
      return BodyOp.op_retain(retain, attributes);
    } else {
      throw Errors.badValue(quillOp, 'Quill delta operation');
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

    return new BodyOp(BodyOp.CODE_delete, count);
  }

  /**
   * Constructs a new "insert embed" operation.
   *
   * @param {string} type The "type" of the embed. Must conform to "identifier"
   *   syntax.
   * @param {*} value Arbitrary embed data, as defined by the embed type. Must
   *   be a deep-freezable data value (see {@link DataUtil#deepFreeze}).
   * @param {object|null} [attributes = null] Attributes to apply to (or
   *   associate with) the text, or `null` if there are no attributes to apply.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_embed(type, value, attributes = null) {
    TString.identifier(type);
    value = DataUtil.deepFreeze(value);

    const attribArg = BodyOp._attributesArg(attributes);

    return new BodyOp(BodyOp.CODE_embed, type, value, ...attribArg);
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

    return new BodyOp(BodyOp.CODE_retain, count, ...attribArg);
  }

  /**
   * Constructs a new "insert text" operation.
   *
   * @param {string} text The text to insert. Must be non-empty.
   * @param {object|null} [attributes = null] Attributes to apply to (or
   *   associate with) the text, or `null` if there are no attributes to apply.
   * @returns {BodyOp} The corresponding operation.
   */
  static op_text(text, attributes = null) {
    TString.nonEmpty(text);
    const attribArg = BodyOp._attributesArg(attributes);

    return new BodyOp(BodyOp.CODE_text, text, ...attribArg);
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
      case BodyOp.CODE_delete: {
        const [count] = payload.args;
        return Object.freeze({ opName, count });
      }

      case BodyOp.CODE_embed: {
        const [type, value, attributes = null] = payload.args;
        return Object.freeze({ opName, type, value, attributes });
      }

      case BodyOp.CODE_retain: {
        const [count, attributes = null] = payload.args;
        return Object.freeze({ opName, count, attributes });
      }

      case BodyOp.CODE_text: {
        const [text, attributes = null] = payload.args;
        return Object.freeze({ opName, text, attributes });
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
    return (opName === BodyOp.CODE_text) || (opName === BodyOp.CODE_embed);
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
      case BodyOp.CODE_delete: {
        return { delete: props.count };
      }

      case BodyOp.CODE_embed: {
        const { type, value, attributes } = props;
        const insert = { [type]: value };

        return attributes
          ? { insert, attributes }
          : { insert };
      }

      case BodyOp.CODE_retain: {
        const { count: retain, attributes } = props;

        return attributes
          ? { retain, attributes }
          : { retain };
      }

      case BodyOp.CODE_text: {
        const { text: insert, attributes } = props;

        return attributes
          ? { insert, attributes }
          : { insert };
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
      throw Errors.badValue(value, 'body attributes');
    }
  }
}
