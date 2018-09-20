// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp, RevisionNumber } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import fileStoreOt_Errors from './Errors';
import FileSnapshot from './FileSnapshot';
import StorageId from './StorageId';
import StoragePath from './StoragePath';

/**
 * {Map<string,string>} Map from each operation name to the corresponding name
 * of the error to throw in response to a failure to satisfy that operation.
 */
const OP_TO_ERROR_MAP = new Map(Object.entries({
  blobAbsent:  'blobNotAbsent',
  blobPresent: 'blobNotFound',
  pathAbsent:  'pathNotAbsent',
  pathIs:      'pathHashMismatch',
  pathIsNot:   'pathHashMismatch',
  pathPresent: 'pathNotFound',
  revNumIs:    'revNumMismatch'
}));

/**
 * Operation which defines a predicate on a {@link FileSnapshot}.
 */
export default class PredicateOp extends BaseOp {
  /** {string} Opcode constant for "blob absent" operations. */
  static get CODE_blobAbsent() {
    return 'blobAbsent';
  }

  /** {string} Opcode constant for "blob present" operations. */
  static get CODE_blobPresent() {
    return 'blobPresent';
  }

  /** {string} Opcode constant for "path absent" operations. */
  static get CODE_pathAbsent() {
    return 'pathAbsent';
  }

  /** {string} Opcode constant for "path is" operations. */
  static get CODE_pathIs() {
    return 'pathIs';
  }

  /** {string} Opcode constant for "path is not" operations. */
  static get CODE_pathIsNot() {
    return 'pathIsNot';
  }

  /** {string} Opcode constant for "path present" operations. */
  static get CODE_pathPresent() {
    return 'pathPresent';
  }

  /** {string} Opcode constant for "revision number is" operations. */
  static get CODE_revNumIs() {
    return 'revNumIs';
  }

  /**
   * Constructs a new "blob absent" operation.
   *
   * @param {string|FrozenBuffer} hash Hash of the blob to check for the absence
   *   of, or a buffer whose hash is to be used as the blob identifier.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_blobAbsent(hash) {
    hash = StorageId.checkOrGetHash(hash);
    return new PredicateOp(PredicateOp.CODE_blobAbsent, hash);
  }

  /**
   * Constructs a new "blob present" operation.
   *
   * @param {string|FrozenBuffer} hash Hash of the blob to check for the
   *   presence of, or a buffer whose hash is to be used as the blob identifier.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_blobPresent(hash) {
    hash = StorageId.checkOrGetHash(hash);
    return new PredicateOp(PredicateOp.CODE_blobPresent, hash);
  }

  /**
   * Constructs a new "path absent" operation.
   *
   * @param {string} path Storage path to check for the absence of.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_pathAbsent(path) {
    StoragePath.check(path);

    return new PredicateOp(PredicateOp.CODE_pathAbsent, path);
  }

  /**
   * Constructs a new "path is" operation.
   *
   * @param {string} path Storage path to check.
   * @param {string|FrozenBuffer} hash Hash of the blob to compare to what is
   *   stored at `path`, or a buffer whose hash is to be used as the blob
   *   identifier.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_pathIs(path, hash) {
    StoragePath.check(path);
    hash = StorageId.checkOrGetHash(hash);

    return new PredicateOp(PredicateOp.CODE_pathIs, path, hash);
  }

  /**
   * Constructs a new "path is not" operation.
   *
   * @param {string} path Storage path to check.
   * @param {string|FrozenBuffer} hash Hash of the blob to compare to what is
   *   stored at `path`, or a buffer whose hash is to be used as the blob
   *   identifier.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_pathIsNot(path, hash) {
    StoragePath.check(path);
    hash = StorageId.checkOrGetHash(hash);

    return new PredicateOp(PredicateOp.CODE_pathIsNot, path, hash);
  }

  /**
   * Constructs a new "path present" operation.
   *
   * @param {string} path Storage path to check for the presence of.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_pathPresent(path) {
    StoragePath.check(path);

    return new PredicateOp(PredicateOp.CODE_pathPresent, path);
  }

  /**
   * Constructs a new "revision number is" operation.
   *
   * @param {int} revNum Revision number to check for.
   * @returns {PredicateOp} An appropriately-constructed operation.
   */
  static op_revNumIs(revNum) {
    RevisionNumber.check(revNum);

    return new PredicateOp(PredicateOp.CODE_revNumIs, revNum);
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
      case PredicateOp.CODE_blobAbsent:
      case PredicateOp.CODE_blobPresent: {
        const [hash] = payload.args;
        return Object.freeze({ opName, hash });
      }

      case PredicateOp.CODE_pathAbsent:
      case PredicateOp.CODE_pathPresent: {
        const [path] = payload.args;
        return Object.freeze({ opName, path });
      }

      case PredicateOp.CODE_pathIs:
      case PredicateOp.CODE_pathIsNot: {
        const [path, hash] = payload.args;
        return Object.freeze({ opName, path, hash });
      }

      case PredicateOp.CODE_revNumIs: {
        const [revNum] = payload.args;
        return Object.freeze({ opName, revNum });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Tests the predicate defined by this instance on the given snapshot.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @returns {boolean} `true` if `snapshot` passes the test defined by this
   *   instance, or `false` if not.
   */
  test(snapshot) {
    FileSnapshot.check(snapshot);

    // Dispatch to the private static method `_op_<opName>`.
    const clazz   = this.constructor;
    const props   = this.props;
    const handler = clazz[`_op_${props.opName}`];
    if (!handler) {
      throw Errors.wtf(`Missing handler for op: ${props.opName}`);
    }

    return handler.call(clazz, snapshot, props);
  }

  /**
   * Tests the predicate defined by this instance on the given snapshot. If
   * the predicate is satisfied, this will return without any further action.
   * If the predicate is not satisfied, this will throw an error.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @throws {InfoError} Error describing the reason for dissatisfaction.
   */
  throwIfNotSatisfied(snapshot) {
    const passed = this.test(snapshot);

    if (!passed) {
      const payload   = this._payload;
      const errorName = OP_TO_ERROR_MAP.get(payload.name);

      throw fileStoreOt_Errors[errorName](...payload.args);
    }
  }

  // TODO: implement predicate op specific validation
  _impl_validate() {
    return true;
  }

  /**
   * Runs the test for `blobAbsent` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_blobAbsent(snapshot, props) {
    return snapshot.getOrNull(props.hash) === null;
  }

  /**
   * Runs the test for `blobPresent` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_blobPresent(snapshot, props) {
    return snapshot.getOrNull(props.hash) !== null;
  }

  /**
   * Runs the test for `pathAbsent` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_pathAbsent(snapshot, props) {
    return snapshot.getOrNull(props.path) === null;
  }

  /**
   * Runs the test for `pathIs` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_pathIs(snapshot, props) {
    const got = snapshot.getOrNull(props.path);

    return (got !== null) && (got.hash === props.hash);
  }

  /**
   * Runs the test for `pathIsNot` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_pathIsNot(snapshot, props) {
    const got = snapshot.getOrNull(props.path);

    return (got === null) || (got.hash !== props.hash);
  }

  /**
   * Runs the test for `pathPresent` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_pathPresent(snapshot, props) {
    return snapshot.getOrNull(props.path) !== null;
  }

  /**
   * Runs the test for `revNumIs` operations.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @param {object} props Operation properties as a plain object.
   * @returns {boolean} Test result.
   */
  static _op_revNumIs(snapshot, props) {
    return snapshot.revNum === props.revNum;
  }

  /**
   * Subclass-specific implementation of {@link #isValidPayload}.
   *
   * @param {Functor} payload_unused The would-be payload for an instance.
   * @returns {boolean} `true` if `payload` is valid, or `false` if not.
   */
  static _impl_isValidPayload(payload_unused) {
    // **TODO:** Fill this in!
    return true;
  }
}
