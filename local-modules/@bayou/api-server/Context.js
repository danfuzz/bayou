// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Message, Remote } from '@bayou/api-common';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors, Random } from '@bayou/util-common';

import { BaseConnection } from './BaseConnection';
import { ContextInfo } from './ContextInfo';
import { ProxiedObject } from './ProxiedObject';
import { Target } from './Target';

/**
 * Binding context for an API server or session therein, with linkage back to
 * a {@link BaseConnection}. Instances of this class are used to map from IDs to
 * `Target` instances, including targets which are ephemerally bound to the
 * session as well as ones that are authorized via bearer tokens.
 */
export class Context extends CommonBase {
  /**
   * Constructs an instance which is initially empty (has no bound targets).
   *
   * @param {ContextInfo} info The typically-fixed parameters used to construct
   *   instances.
   * @param {BaseConnection} connection The connection to be associated with.
   *   This is used for a couple of things, including accessing (HTTP-ish)
   *   headers / cookies, as well as logging.
   */
  constructor(info, connection) {
    super();

    /**
     * {ContextInfo} The typically-fixed parameters used to construct this
     * instance.
     */
    this._info = ContextInfo.check(info);

    /** {BaseConnection} The connection this instance is associated with. */
    this._connection = BaseConnection.check(connection);

    /** {Map<string, Target>} The underlying map from IDs to targets. */
    this._map = new Map();

    /**
     * {Map<object, Remote>} Map from target objects (the things wrapped by
     * instances of {@link Target}) to their corresponding {@link Remote}
     * instances.
     */
    this._remoteMap = new Map();

    Object.freeze(this);
  }

  /** {Codec} The codec to use for connections / sessions. */
  get codec() {
    return this._info.codec;
  }

  /** {Logger} The logger used by this instance. */
  get log() {
    return this._connection.log;
  }

  /** {BaseTokenAuthorizer|null} The token authorizer to use. */
  get tokenAuthorizer() {
    return this._info.tokenAuthorizer;
  }

  /**
   * Adds a {@link Target} to this instance's map of same, and also adds the
   * remote map from the target's wrapped object to its corresponding
   * {@link Remote} representative. The given `target` must not have an ID that
   * is already represented in the map. In addition, the object wrapped by
   * `target` must not already be bound to another ID. (That is, for any given
   * instance of this class, there is a one-to-one mapping between IDs and
   * direct target objects.)
   *
   * @param {Target} target Target to add.
   * @returns {Remote} Remote representative object that can be used to refer to
   *   `target` over the API boundary.
   * @throws {Error} Thrown if either `target.id` or `target.directObject` is
   *   already represented in the target map.
   */
  addTarget(target) {
    Target.check(target);

    const id     = target.id;
    const obj    = target.directObject;
    const remote = new Remote(id);

    if (this._getOrNull(id) !== null) {
      throw this._targetError(id, 'Duplicate target ID');
    }

    if (this._remoteMap.has(obj)) {
      throw this._targetError(id, 'Duplicate target object');
    }

    this._map.set(id, target);
    this._remoteMap.set(obj, remote);

    return remote;
  }

  /**
   * Decodes an object from JSON representation, using this instance's
   * associated {@link Codec}.
   *
   * @param {string} encoded Encoded value.
   * @returns {*} Decoded value.
   */
  decodeJson(encoded) {
    return this.codec.decodeJson(encoded);
  }

  /**
   * Encodes an object into JSON representation, using this instance's
   * associated {@link Codec}.
   *
   * @param {*} value Value to encode.
   * @returns {string} JSON-encoded form.
   */
  encodeJson(value) {
    return this.codec.encodeJson(value);
  }

  /**
   * Encodes a {@link Message} suitable for sending to the other side of the
   * connection that this instance is used for.
   *
   * @param {Message} message Message to encode.
   * @returns {string} JSON-encoded form of `message`.
   */
  encodeMessage(message) {
    Message.check(message);

    return this.encodeJson(message);
  }

  /**
   * Gets an authorized target. This will find targets that were previously
   * added via {@link #addTarget} as well as those authorized by virtue of this
   * method being passed a valid authority-bearing token (in string form).
   *
   * @param {string} idOrToken The target ID or a bearer token (in string form)
   *   which authorizes access to a target.
   * @returns {Target} The so-identified or so-authorized target.
   * @throws {Error} Thrown if `idOrToken` does not correspond to an authorized
   *   target.
   */
  async getAuthorizedTarget(idOrToken) {
    const tokenAuth = this.tokenAuthorizer;

    if ((tokenAuth !== null) && tokenAuth.isToken(idOrToken)) {
      const token   = tokenAuth.tokenFromString(idOrToken);
      const already = this._getOrNull(token.id);

      if (already !== null) {
        // We've seen this token ID previously in this context / session.
        if (token.sameToken(already.token)) {
          // The corresponding secrets match. All's well!
          return already;
        } else {
          // The secrets don't match. This will happen, for example, when a
          // malicious actor tries to probe for a token.
          throw this._targetError(idOrToken);
        }
      }

      // It's the first time this token has been encountered in this context.
      // Determine its authorized target, and if authorized cache it in this
      // instance's target map.

      // **TODO:** `null` below should actually be an object with all the right
      // cookies, if any.
      const targetObject = await tokenAuth.getAuthorizedTarget(token, null);

      if (targetObject === null) {
        // The `tokenAuth` told us that `token` didn't actually grant any
        // authority.
        throw this._targetError(idOrToken);
      }

      const target = new Target(token, targetObject);

      this.addTarget(target);
      return target;
    }

    // It's not a bearer token (or this instance doesn't deal with bearer tokens
    // at all). The ID can only validly refer to an uncontrolled target.

    const result = this._getOrNull(idOrToken);

    if ((result === null) || (result.token !== null)) {
      // This uses the default error message ("unknown target") even when it's
      // due to a target existing but being controlled, so as not to reveal that
      // the ID corresponds to an existing token (which is arguably a security
      // leak).
      throw this._targetError(idOrToken);
    }

    return result;
  }

  /**
   * Gets a {@link Remote} which can be used with this instance to refer to
   * the given {@link ProxiedObject}. If `proxiedObject` has been encountered
   * before, the result will be a pre-existing instance of {@link Remote};
   * otherwise, it will be a newly-constructed instance (and will get added to
   * this instance's set of targets).
   *
   * @param {ProxiedObject} proxiedObject Object to proxy.
   * @returns {Remote} Corresponding remote representation.
   */
  getRemoteFor(proxiedObject) {
    ProxiedObject.check(proxiedObject);

    const obj     = proxiedObject.target;
    const already = this._remoteMap.get(obj);

    if (already !== undefined) {
      return already;
    }

    const targetId = this._randomId();
    const target   = new Target(targetId, obj);
    const remote   = this.addTarget(target);

    this.log.event.newRemote(targetId, obj);

    return remote;
  }

  /**
   * Returns an indication of whether or not this instance has a binding for
   * the given ID. **Note:** This will find already-authorized bearer tokens,
   * but it will _not_ perform authorization given a never-before-encountered
   * bearer token.
   *
   * @param {string} id The target ID.
   * @returns {boolean} `true` iff `id` is bound.
   */
  hasId(id) {
    return this._getOrNull(id) !== null;
  }

  /**
   * Gets the target associated with the indicated ID, or `null` if the
   * so-identified target does not exist. This only checks this instance's
   * {@link #_map}; it does _not_ try to do token authorization.
   *
   * @param {string} id The target ID.
   * @returns {Target|null} The so-identified target, or `null` if unbound.
   */
  _getOrNull(id) {
    TString.check(id);

    const result = this._map.get(id);
    return (result === undefined) ? null : result;
  }

  /**
   * Makes a new random ID for use with this instance, which (a) is guaranteed
   * not to be used by the instance already, and (b) will not be mistaken by
   * the token handler (if any) for a token. **Note:** If not bound promptly
   * (that is, within the same turn of execution when this method is called), it
   * is conceivably possible for a duplicate ID to be returned and then
   * ultimately result in a "duplicate target" error in {@link #addTarget}.
   *
   * @returns {string} A random unused target ID.
   */
  _randomId() {
    const tokenAuth = this.tokenAuthorizer;
    const prefix    = (tokenAuth === null) ? 'local-' : tokenAuth.nonTokenPrefix;

    for (;;) {
      const result = `${prefix}${Random.hexByteString(4)}`;

      if (!this.hasId(result)) {
        return result;
      }

      // We managed to get an ID collision. Unlikely, but it can happen. So,
      // just iterate and try again.
    }
  }

  /**
   * Constructs a target-related error in a standard form. In particular, it
   * redacts the given ID if it turns out to be a full token.
   *
   * @param {string} idOrToken ID or token to report about.
   * @param {string} [msg = 'Unknown target'] Pithy message about the problem.
   * @returns {Error} An appropriately-constructed error.
   */
  _targetError(idOrToken, msg = 'Unknown target') {
    const tokenAuth = this.tokenAuthorizer;
    const idToReport = ((tokenAuth !== null) && tokenAuth.isToken(idOrToken))
      ? tokenAuth.tokenFromString(idOrToken).safeString
      : idOrToken;

    return Errors.badUse(`${msg}: ${idToReport}`);
  }
}
