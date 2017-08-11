// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { CommonBase, DataUtil, FrozenBuffer } from 'util-common';

import StoragePath from './StoragePath';

/**
 * {Symbol} Private key used to protect the main constructor. This is used so
 * that only the static constructor methods can use it. This makes it less
 * likely that a bogus instance will get constructed (and pretty obvious if
 * someone writes code to try to sneak around the restriction, which ought to
 * be a red flag).
 */
const KEY = Symbol('FileOp constructor key');

// Operation category constants. See docs on the static properties for details.
const CAT_CONVENIENCE  = 'convenience';
const CAT_DELETE       = 'delete';
const CAT_ENVIRONMENT  = 'environment';
const CAT_PREREQUISITE = 'prerequisite';
const CAT_READ         = 'read';
const CAT_REVISION     = 'revision';
const CAT_WAIT         = 'wait';
const CAT_WRITE        = 'write';

/** {array<string>} List of categories in defined execution order. */
const CATEGORY_EXECUTION_ORDER = [
  CAT_ENVIRONMENT, CAT_REVISION, CAT_PREREQUISITE, CAT_READ, CAT_DELETE,
  CAT_WRITE, CAT_WAIT
];

// Schema argument type constants. See docs on the static properties for
// details.
const TYPE_BUFFER    = 'Buffer';
const TYPE_DUR_MSEC  = 'DurMsec';
const TYPE_PATH      = 'Path';
const TYPE_HASH      = 'Hash';
const TYPE_REV_NUM   = 'RevNum';

// Operation schemata. See the doc for the equivalent static property for
// details.
//
// **Note:** The comments below aren't "real" JSDoc comments, because JSDoc
// has no way of understanding that the elements cause methods to be generated.
// So it goes.
const OPERATIONS = DataUtil.deepFreeze([
  /*
   * A `checkBlob` operation. This is a prerequisite operation that verifies
   * that the file stores a blob with the indicated hash.
   *
   * @param {string} hash The expected hash.
   */
  [CAT_PREREQUISITE, 'checkBlob', ['hash', TYPE_HASH]],

  /*
   * A `checkBlobAbsent` operation. This is a prerequisite operation that
   * verifies that the file does not store a blob with the indicated hash.
   *
   * @param {string} hash The expected-to-be-absent hash.
   */
  [CAT_PREREQUISITE, 'checkBlobAbsent', ['hash', TYPE_HASH]],

  /*
   * A `checkPathAbsent` operation. This is a prerequisite operation that
   * verifies that a given storage path is not bound to any value. This is the
   * opposite of `checkPathExists`.
   *
   * @param {string} storagePath The storage path to check.
   */
  [CAT_PREREQUISITE, 'checkPathAbsent', ['storagePath', TYPE_PATH]],

  /*
   * A `checkPathExists` operation. This is a prerequisite operation that
   * verifies that a given storage path is bound to a value (any value,
   * including one of zero length). This is the opposite of the
   * `checkPathAbsent` operation.
   *
   * @param {string} storagePath The storage path to check.
   */
  [CAT_PREREQUISITE, 'checkPathExists', ['storagePath', TYPE_PATH]],

  /*
   * Convenience wrapper for `checkPathHash` operations, which uses a given
   * buffer's data. This is equivalent to `checkPathHash(storagePath,
   * buffer.hash)`.
   *
   * @param {string} storagePath The storage path to check.
   * @param {FrozenBuffer} value Buffer whose hash should be taken.
   */
  [
    CAT_CONVENIENCE, 'checkPathBufferHash',
    ['storagePath', TYPE_PATH], ['value', TYPE_BUFFER]
  ],

  /*
   * A `checkPathHash` operation. This is a prerequisite operation that
   * verifies that a given storage path is bound to a value whose hash is as
   * given.
   *
   * @param {string} storagePath The storage path to check.
   * @param {string} hash The expected hash.
   */
  [
    CAT_PREREQUISITE, 'checkPathHash',
    ['storagePath', TYPE_PATH], ['hash', TYPE_HASH]
  ],

  /*
   * A `deleteAll` operation. This is a write operation that removes all stored
   * items in the file. If the file was already empty, then this operation does
   * nothing.
   */
  [CAT_DELETE, 'deleteAll'],

  /*
   * A `deleteBlob` operation. This is a write operation that removes from the
   * file the blob with the indicated hash, if any. If there was no such blob,
   * then this operation does nothing.
   *
   * @param {string} hash The hash of the blob to delete.
   */
  [CAT_DELETE, 'deleteBlob', ['hash', TYPE_HASH]],

  /*
   * A `deletePath` operation. This is a write operation that deletes the
   * binding for the given path, if any. If the path wasn't bound, then this
   * operation does nothing.
   *
   * @param {string} storagePath The storage path to delete.
   */
  [CAT_DELETE, 'deletePath', ['storagePath', TYPE_PATH]],

  /*
   * A `readBlob` operation. This is a read operation that retrieves the full
   * value of the indicated blob (identified by hash), if any. If there is no
   * so-identified blob in the file, then the hash is _not_ represented in the
   * result of the transaction at all (specifically, it is _not_ bound to `null`
   * or similar).
   *
   * **Rationale for not-found behavior:** Higher layers of the system can
   * produce interpreted transaction results, where a `null` value can represent
   * successfully finding `null`. By consistently _not_ binding non-found
   * results, we provide disambiguation in such cases.
   *
   * @param {string} hash The content hash of the blob to read.
   */
  [CAT_READ, 'readBlob', ['hash', TYPE_HASH]],

  /*
   * A `readPath` operation. This is a read operation that retrieves the value
   * bound to the indicated path in the file, if any. If the given path is not
   * bound, then that path is _not_ represented in the result of the transaction
   * at all (specifically, it is _not_ bound to `null` or similar).
   *
   * **Rationale for not-found behavior:** Higher layers of the system can
   * produce interpreted transaction results, where a `null` value can represent
   * successfully finding `null`. By consistently _not_ binding non-found
   * results, we provide disambiguation in such cases.
   *
   * @param {string} storagePath The storage path to read from.
   */
  [CAT_READ, 'readPath', ['storagePath', TYPE_PATH]],

  /*
   * A `revNum` operation. This is a revision restriction that limits a
   * transaction to only be performed with respect to the indicated revision
   * number.
   *
   * **Note:** It is an error (and pointless) for a transaction to contain more
   * than one `revNum` operation.
   *
   * @param {Int} revNum Required revision number.
   */
  [CAT_REVISION, 'revNum', ['revNum', TYPE_REV_NUM]],

  /*
   * A `timeout` operation. This is an environment operation which limits a
   * transaction to take no more than the indicated amount of time before it is
   * aborted. Timeouts are performed on a "best effort" basis as well as
   * silently clamped to implementation-specific limits (if any).
   *
   * **Note:** It is an error for a transaction to contain more than one
   * `timeout` operation.
   *
   * @param {Int} durMsec Duration of the timeout, in milliseconds.
   */
  [CAT_ENVIRONMENT, 'timeout', ['durMsec', TYPE_DUR_MSEC]],

  /*
   * A `whenPathNot` operation. This is a wait operation that blocks the
   * transaction until a specific path does not store data which hashes as
   * given. This includes both storing data with other hashes as well as the
   * path being absent (not storing any data).
   *
   * @param {string} storagePath The storage path to observe.
   * @param {string} hash Hash of the blob which must _not_ be at `storagePath`
   *   for the operation to complete.
   */
  [CAT_WAIT, 'whenPathNot', ['storagePath', TYPE_PATH], ['hash', TYPE_HASH]],

  /*
   * A `whenPathAbsent` operation. This is a wait operation that blocks the
   * transaction until a specific path _does not_ have any data stored.
   *
   * @param {string} storagePath The storage path to observe.
   */
  [CAT_WAIT, 'whenPathAbsent', ['storagePath', TYPE_PATH]],

  /*
   * Convenience wrapper for `whenPathNot` operations, which hashes a given
   * buffer's data. This is equivalent to `whenPathNot(buffer.hash)`.
   *
   * @param {string} storagePath The storage path to observe.
   * @param {string} hash Hash of the blob which must _not_ be at `storagePath`
   *   for the operation to complete.
   */
  [
    CAT_CONVENIENCE, 'whenPathNotBuffer',
    ['storagePath', TYPE_PATH], ['value', TYPE_BUFFER]
  ],

  /*
   * A `writeBlob` operation. This is a write operation that stores the
   * indicated value in the file, binding it to its content hash. If the content
   * hash was already bound, then this operation does nothing.
   *
   * @param {FrozenBuffer} value The value to store.
   */
  [CAT_WRITE, 'writeBlob', ['value', TYPE_BUFFER]],

  /*
   * A `writePath` operation. This is a write operation that stores the
   * indicated value in the file, binding it to the given path. If the path was
   * already bound to that value, then this operation does nothing.
   *
   * @param {string} storagePath The storage path to bind to.
   * @param {FrozenBuffer} value The value to store and bind to `storagePath`.
   */
  [CAT_WRITE, 'writePath', ['storagePath', TYPE_PATH], ['value', TYPE_BUFFER]]
]);

/**
 * Operation to perform on a file as part of a transaction. In terms of overall
 * structure, an operation consists of a string name and arbitrary additional
 * arguments. Each specific named operation defines the allowed shape of its
 * arguments. Instances of this class are immutable. Operations can be
 * categorized as follows:
 *
 * * Environment ops &mdash; An environment operation performs some action or
 *   checks some aspect of the execution environment of the transaction.
 * * Revision restrictions &mdash; A revision restriction limits a transaction
 *   to being based only on a certain revision of the file.
 * * Prerequisite checks &mdash; A prerequisite check must pass in order for
 *   the remainder of a transaction to apply.
 * * Data reads &mdash; A data read gets the value of a blob within a file.
 * * Data deletions &mdash; A data deletion erases previously-existing data
 *   within a file.
 * * Data writes &mdash; A data write stores new data into a file.
 * * Waits &mdash; A wait operation blocks a transaction until some condition
 *   holds. **Note:** A transaction specification must not include more than
 *   one wait operation, and if it has one, the transaction must not perform any
 *   reads, deletes, or writes.
 *
 * When executed, the operations of a transaction are effectively performed in
 * order by category; but within a category there is no effective ordering.
 * Specifically, the category ordering is as listed above.
 *
 * There are static methods on this class to construct each named operation,
 * named `op_<name>`, as well as some convenience methods to construct variants.
 * See documentation on those methods for details about the meaning and
 * arguments of each of these.
 */
export default class FileOp extends CommonBase {
  /**
   * {string} Operation category for convenience wrapper ops. This category only
   * shows up in `OPERATIONS`, not in actual operation instances.
   */
  static get CAT_CONVENIENCE() {
    return CAT_CONVENIENCE;
  }

  /** {string} Operation category for deletion ops. */
  static get CAT_DELETE() {
    return CAT_DELETE;
  }

  /** {string} Operation category for environment ops. */
  static get CAT_ENVIRONMENT() {
    return CAT_ENVIRONMENT;
  }

  /** {string} Operation category for prerequisites. */
  static get CAT_PREREQUISITE() {
    return CAT_PREREQUISITE;
  }

  /** {string} Operation category for data reads. */
  static get CAT_READ() {
    return CAT_READ;
  }

  /** {string} Operation category for revision restrictions. */
  static get CAT_REVISION() {
    return CAT_REVISION;
  }

  /** {string} Operation category for waits. */
  static get CAT_WAIT() {
    return CAT_WAIT;
  }

  /** {string} Operation category for data writes. */
  static get CAT_WRITE() {
    return CAT_WRITE;
  }

  /**
   * {array<array>} List of operation schemata. These are used to
   * programatically define static methods on `FileOp` for constructing
   * instances. Each element consists of three parts, as follows:
   *
   * * `category` &mdash; The category of the operation.
   * * `name` &mdsah; The name of the operation.
   * * `argInfo` &mdash; One or more elements indicating the names and types of
   *   the arguments to the operation. Each argument is represented as a two-
   *   element array `[<name>, <type>]`, where `<type>` is one of the type
   *   constants defined by this class.
   *
   * This value is deep frozen. Attempts to mutate it will fail.
   */
  static get OPERATIONS() {
    return OPERATIONS;
  }

  /** {string} Type name for a `FrozenBuffer`. */
  static get TYPE_BUFFER() {
    return TYPE_BUFFER;
  }

  /** {string} Type name for a millisecond-accuracy duration. */
  static get TYPE_DUR_MSEC() {
    return TYPE_DUR_MSEC;
  }

  /** {string} Type name for storage paths. */
  static get TYPE_PATH() {
    return TYPE_PATH;
  }

  /**
   * {string} Type name for hash values. Arguments of this type will also
   * accept instances of `FrozenBuffer`. When given a buffer, the constructor
   * automatically converts it to its hash.
   */
  static get TYPE_HASH() {
    return TYPE_HASH;
  }

  /** {string} Type name for revision numbers. */
  static get TYPE_REV_NUM() {
    return TYPE_REV_NUM;
  }

  /**
   * Sorts an `Iterable` (e.g. an array) of `FileOp`s by category, in the
   * prescribed order of execution. Within a category, the result's ordering is
   * arbitrary; that is, the sort is not guaranteed to be stable. The return
   * value is a newly-constructed array; the original input is left unmodified.
   *
   * @param {Iterable<FileOp>} orig `Iterable` collection of `FileOp`s to sort.
   * @returns {array<FileOp>} Array in the defined category-sorted order.
   */
  static sortByCategory(orig) {
    for (const op of orig) {
      FileOp.check(op);
    }

    const result = [];

    for (const cat of CATEGORY_EXECUTION_ORDER) {
      for (const op of orig) {
        if (op.category === cat) {
          result.push(op);
        }
      }
    }

    return result;
  }

  /**
   * Validates a category string. Throws an error given an invalid category.
   *
   * @param {*} category The (alleged) category string.
   * @returns {string} `category` but only if valid.
   */
  static validateCategory(category) {
    switch (category) {
      case CAT_DELETE:
      case CAT_ENVIRONMENT:
      case CAT_PREREQUISITE:
      case CAT_READ:
      case CAT_REVISION:
      case CAT_WAIT:
      case CAT_WRITE: {
        return category;
      }
      default: {
        throw new Error(`Invalid category: ${category}`);
      }
    }
  }

  /**
   * Constructs an instance. This should not be used directly. Instead use the
   * static constructor methods defined by this class.
   *
   * @param {object} constructorKey The private-to-this-module key that
   *   enforces the exhortation in the method documentation above.
   * @param {string} category The operation category.
   * @param {string} name The operation name.
   * @param {Map<string,*>} args Arguments to the operation.
   */
  constructor(constructorKey, category, name, args) {
    if (constructorKey !== KEY) {
      throw new Error('Constructor is private.');
    }

    super();

    /** {string} The operation category. */
    this._category = FileOp.validateCategory(category);

    /** {string} The operation name. */
    this._name = TString.nonempty(name);

    /** {Map<string,*>} Arguments to the operation. */
    this._args = args;

    Object.freeze(this);
  }

  /** {string} The operation category. */
  get category() {
    return this._category;
  }

  /** {string} The operation name. */
  get name() {
    return this._name;
  }

  /**
   * Gets the operation argument with the given name. It is an error to
   * request an argument that is not bound. Return values are guaranteed to be
   * deep frozen.
   *
   * @param {string} name The argument name.
   * @returns {*} Corresponding argument value.
   */
  arg(name) {
    const result = this._args.get(name);

    if (result === undefined) {
      throw new Error(`No such argument: ${name}`);
    }

    return result;
  }

  /**
   * Based on the operation `OPERATIONS`, add `static` constructor methods to
   * this class. This method is called during class initialization. (Look at
   * the bottome of this file for the call.)
   */
  static _addConstructorMethods() {
    for (const [category, opName, ...argInfo] of OPERATIONS) {
      const isConvenience = (category === CAT_CONVENIENCE);
      const constructorMethod = (...args) => {
        if (args.length !== argInfo.length) {
          throw new Error(`Wrong argument count for op constructor. Expected ${argInfo.length}.`);
        }

        const argMap = isConvenience ? null : new Map();
        for (let i = 0; i < argInfo.length; i++) {
          const [name, type] = argInfo[i];
          let arg = args[i];
          switch (type) {
            case TYPE_BUFFER: {
              FrozenBuffer.check(arg);
              break;
            }
            case TYPE_DUR_MSEC: {
              TInt.nonNegative(arg);
              break;
            }
            case TYPE_HASH: {
              if (arg instanceof FrozenBuffer) {
                arg = arg.hash;
              } else {
                // **TODO:** Better validation of hashes.
                TString.nonempty(arg);
              }
              break;
            }
            case TYPE_PATH: {
              StoragePath.check(arg);
              break;
            }
            case TYPE_REV_NUM: {
              TInt.nonNegative(arg);
              break;
            }
            default: {
              // Indicates a bug in this class.
              throw new Error(`Weird \`type\` constant: ${type}`);
            }
          }

          if (argMap) {
            argMap.set(name, arg);
          }
        }

        if (isConvenience) {
          const [newOpName, ...newArgs] = FileOp[`_xform_${opName}`](...args);
          return FileOp[`op_${newOpName}`](...newArgs);
        } else {
          return new FileOp(KEY, category, opName, argMap);
        }
      };

      FileOp[`op_${opName}`] = constructorMethod;
    }
  }

  /**
   * Transformer for the convenience op `checkPathBufferHash`.
   *
   * @param {string} storagePath The storage path.
   * @param {FrozenBuffer} value The value.
   * @returns {array<*>} Replacement constructor info.
   */
  static _xform_checkPathBufferHash(storagePath, value) {
    return ['checkPathHash', storagePath, value.hash];
  }

  /**
   * Transformer for the convenience op `whenPathNotBuffer`.
   *
   * @param {string} storagePath The storage path.
   * @param {FrozenBuffer} value The value.
   * @returns {array<*>} Replacement constructor info.
   */
  static _xform_whenPathNotBuffer(storagePath, value) {
    return ['whenPathNot', storagePath, value.hash];
  }
}

// Build and bind all the static constructor methods.
FileOp._addConstructorMethods();
