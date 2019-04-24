// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken, TargetId } from '@bayou/api-common';
import { RedactUtil } from '@bayou/see-all';
import { TFunction, TObject } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

import Schema from './Schema';

/** {Int} Maximum depth to produce when redacting values. */
const MAX_REDACTION_DEPTH = 4;

/**
 * Wrapper for an object which is callable through the API. A target can be
 * either "controlled" by a token (that is, have access restricted to only those
 * who prove knowledge of a token's secret) or be "uncontrolled" (that is, be
 * generally available without additional authorization checks).
 */
export default class Target extends CommonBase {
  /**
   * Like {@link #logInfoFromPayload}, except only to be used when processing
   * `null` as a target (e.g. when a target ID was not valid). Since there is
   * no metadata available in this case, when redaction is on, this method
   * performs full value redaction.
   *
   * @param {Functor} payload The call payload.
   * @param {boolean} shouldRedact Whether redaction should be performed in
   *   general. Even when `false`, some redaction may be performed out of an
   *   abundance of caution.
   * @returns {Functor} The processed replacement for `payload`, or the original
   *   `payload` if no modifications needed to be made.
   */
  static logInfoFromPayloadForNullTarget(payload, shouldRedact) {
    if (!shouldRedact) {
      return Target._logInfoUnredacted(payload);
    } else {
      return RedactUtil.wrapRedacted(RedactUtil.redactValues(payload, MAX_REDACTION_DEPTH));
    }
  }

  /**
   * Like {@link #logInfoFromResult}, except only to be used when processing
   * `null` as a target (e.g. when a target ID was not valid). Since there is
   * no metadata available in this case, when redaction is on, this method
   * performs full value redaction.
   *
   * @param {*} result The result of the call in question.
   * @param {boolean} shouldRedact Whether redaction should be performed in
   *   general. Even when `false`, some redaction may be performed out of an
   *   abundance of caution.
   * @returns {Functor} The processed replacement for `payload`, or the original
   *   `payload` if no modifications needed to be made.
   */
  static logInfoFromResultForNullTarget(result, shouldRedact) {
    if ((result === undefined) || (result === null)) {
      return result;
    } else if (!shouldRedact) {
      return Target._logInfoUnredacted(result);
    } else {
      return RedactUtil.wrapRedacted(RedactUtil.redactValues(result, MAX_REDACTION_DEPTH));
    }
  }

  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {string|BearerToken} idOrToken Either the ID of the target (if
   *   uncontrolled) _or_ the token which authorizes access to the target. In
   *   the latter case, the target's `id` is considered to be the same as the
   *   token's `id`.
   * @param {object} directObject Object to be represented by this instance.
   * @param {Schema|null} schema `directObject`'s schema, if already known.
   */
  constructor(idOrToken, directObject, schema = null) {
    super();

    /**
     * {BearerToken|null} Token which authorizes access to the target, or `null`
     * if this is an uncontrolled instance.
     */
    this._token = (idOrToken instanceof BearerToken) ? idOrToken : null;

    /** {string} The target ID. */
    this._id = TargetId.check((this._token === null) ? idOrToken : this._token.id);

    /**
     * {object} The object which this instance represents, wraps, and generally
     * provides access to.
     */
    this._directObject = TObject.check(directObject);

    /** {Schema} Schema for {@link #_directObject}. */
    this._schema = schema || new Schema(directObject);

    Object.freeze(this);
  }

  /**
   * {string} The name of the class which {@link #directObject} is an instance
   * of.
   */
  get className() {
    const clazz = this._directObject.constructor;

    if ((clazz !== Object) && TFunction.isClass(clazz)) {
      const name = clazz.name;
      if (typeof name === 'string') {
        return name;
      }
    }

    return '<unknown>';
  }

  /**
   * {object} The object which this instance represents, wraps, and generally
   * provides access to. Accessing this property indicates that this instance is
   * _not_ currently idle.
   */
  get directObject() {
    return this._directObject;
  }

  /** {string} The target ID. */
  get id() {
    return this._id;
  }

  /** {Schema} The schema of {@link #directObject}. */
  get schema() {
    return this._schema;
  }

  /**
   * {BearerToken|null} Token which authorizes access to the target, or `null`
   * if this is an uncontrolled instance.
   */
  get token() {
    return this._token;
  }

  /**
   * Synchronously performs a method call on the {@link #directObject},
   * returning the result or (directly) throwing an error.
   *
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {*} The result of performing the call.
   */
  call(payload) {
    Functor.check(payload);

    const name   = payload.name;
    const schema = this._schema;

    if (schema.getDescriptor(name) !== 'method') {
      // Not in the schema, or not a method.
      throw Errors.badUse(`No such method: \`${name}\``);
    }

    // Listed in the schema as a method. So it exists, is public, is in
    // fact bound to a function, etc.

    const obj  = this._directObject;
    const impl = obj[name];

    return impl.apply(obj, payload.args);
  }

  /**
   * Converts the given payload (as presumably passed to an earlier call to
   * {@link #call}, or about to be used as such), so as to be suitable for
   * logging, including performing any necessary redaction.
   *
   * @param {Functor} payload The call payload.
   * @param {boolean} shouldRedact Whether redaction should be performed in
   *   general. Even when `false`, some redaction may be performed out of an
   *   abundance of caution.
   * @returns {Functor} The processed replacement for `payload`, or the original
   *   `payload` if no modifications needed to be made.
   */
  logInfoFromPayload(payload, shouldRedact) {
    if (!shouldRedact) {
      return Target._logInfoUnredacted(payload);
    }

    // **TODO:** Redaction should be driven by target-specific metadata, based
    // on `payload.name` (the method name) as well.

    return RedactUtil.wrapRedacted(RedactUtil.redactValues(payload, MAX_REDACTION_DEPTH));
  }

  /**
   * Converts the given call result (as presumably returned from an earlier call
   * to {@link #call}), so as to be suitable for logging, including performing
   * any necessary redaction.
   *
   * @param {*} result The result of the call in question.
   * @param {Functor} payload_unused The call payload which produced `result`.
   * @param {boolean} shouldRedact Whether redaction should be performed in
   *   general. Even when `false`, some redaction may be performed out of an
   *   abundance of caution.
   * @returns {Functor} The processed replacement for `payload`, or the original
   *   `payload` if no modifications needed to be made.
   */
  logInfoFromResult(result, payload_unused, shouldRedact) {
    if ((result === undefined) || (result === null)) {
      return result;
    } else if (!shouldRedact) {
      return Target._logInfoUnredacted(result);
    }

    // **TODO:** Redaction should be driven by target-specific metadata, based
    // on `payload.name` (the method name) as well.

    return RedactUtil.wrapRedacted(RedactUtil.redactValues(result, MAX_REDACTION_DEPTH));
  }

  /**
   * Helper for the various `logInfo*()` methods, which does processing of
   * payloads and results when most redaction is off (that is when
   * `shouldRedact` is passed as `false`).
   *
   * **Note:** Name notwithstanding, this method ultimately might redact some
   * things out of an abundance of caution.
   *
   * @param {*} value Original value.
   * @returns {*} Appropriately-processed form.
   */
  static _logInfoUnredacted(value) {
    // **TODO:** This should ultimately do some processing, including
    // truncating long arrays / objects / strings, redacting strings that look
    // like tokens, and so on.
    return value;
  }
}
