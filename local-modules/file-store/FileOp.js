// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt } from 'typecheck';
import { CommonBase, DataUtil, Errors, FrozenBuffer } from 'util-common';

import StoragePath from './StoragePath';

// Operation category constants. See docs on the static properties for details.
const CAT_DELETE       = 'delete';
const CAT_ENVIRONMENT  = 'environment';
const CAT_LIST         = 'list';
const CAT_PREREQUISITE = 'prerequisite';
const CAT_READ         = 'read';
const CAT_REVISION     = 'revision';
const CAT_WAIT         = 'wait';
const CAT_WRITE        = 'write';

/** {array<string>} List of categories in defined execution order. */
const CATEGORY_EXECUTION_ORDER = [
  CAT_ENVIRONMENT, CAT_REVISION, CAT_PREREQUISITE, CAT_LIST, CAT_READ,
  CAT_DELETE, CAT_WRITE, CAT_WAIT
];

// Schema argument type constants. See docs on the static properties for
// details.
const TYPE_BUFFER    = 'Buffer';
const TYPE_DUR_MSEC  = 'DurMsec';
const TYPE_HASH      = 'Hash';
const TYPE_INDEX     = 'Index';
const TYPE_PATH      = 'Path';
const TYPE_REV_NUM   = 'RevNum';

// Operation schemata. See the doc for {@link FileOp#propsFromName} for
// details.
//
// **Note:** The comments below aren't "real" JSDoc comments, because JSDoc
// has no way of understanding that the elements cause methods to be generated.
// So it goes.
const OPERATIONS = [
  /*
   * A `checkBlobAbsent` operation. This is a prerequisite operation that
   * verifies that the file does not store a blob with the indicated hash.
   *
   * @param {string} hash The expected-to-be-absent hash.
   */
  [CAT_PREREQUISITE, 'checkBlobAbsent', ['hash', TYPE_HASH]],

  /*
   * A `checkBlobPresent` operation. This is a prerequisite operation that
   * verifies that the file stores a blob with the indicated hash.
   *
   * @param {string} hash The expected hash.
   */
  [CAT_PREREQUISITE, 'checkBlobPresent', ['hash', TYPE_HASH]],

  /*
   * A `checkPathAbsent` operation. This is a prerequisite operation that
   * verifies that a given storage path is not bound to any value. This is the
   * opposite of `checkPathPresent`.
   *
   * @param {string} storagePath The storage path to check.
   */
  [CAT_PREREQUISITE, 'checkPathAbsent', ['storagePath', TYPE_PATH]],

  /*
   * A `checkPathIs` operation. This is a prerequisite operation that verifies
   * that a given storage path is bound to a value whose hash is as given.
   *
   * @param {string} storagePath The storage path to check.
   * @param {string} hash The expected hash.
   */
  [
    CAT_PREREQUISITE, 'checkPathIs',
    ['storagePath', TYPE_PATH], ['hash', TYPE_HASH]
  ],

  /*
   * A `checkPathNot` operation. This is a prerequisite operation that verifies
   * that a given storage path is _not_ bound to a value whose hash is as given.
   * If the path doesn't store any data at all, that counts as success from the
   * perspective of this operation.
   *
   * **Note:** This is the opposite of the `checkPathIs` operation.
   *
   * @param {string} storagePath The storage path to check.
   * @param {string} hash The non-expected hash.
   */
  [
    CAT_PREREQUISITE, 'checkPathNot',
    ['storagePath', TYPE_PATH], ['hash', TYPE_HASH]
  ],

  /*
   * A `checkPathPresent` operation. This is a prerequisite operation that
   * verifies that a given storage path is bound to a value (any value,
   * including one of zero length). This is the opposite of the
   * `checkPathAbsent` operation.
   *
   * @param {string} storagePath The storage path to check.
   */
  [CAT_PREREQUISITE, 'checkPathPresent', ['storagePath', TYPE_PATH]],

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
   * A `deletePathPrefix` operation. This is a write operation that deletes the
   * bindings for the given path and all paths which use it as a prefix, if any.
   * If there were no matching paths bound in the first place, then this
   * operation does nothing.
   *
   * @param {string} storagePath The storage path prefix to delete.
   */
  [CAT_DELETE, 'deletePathPrefix', ['storagePath', TYPE_PATH]],

  /*
   * A `listPathPrefix` operation. This is a read operation that retrieves a
   * list of all paths immediately under the given prefix that store data, or
   * the path itself if it stores data directly. The resulting list can contain
   * both paths that store blobs as well as "directories" under which other
   * blobs are stored. If there are no such paths, the result is an empty list.
   *
   * @param {string} storagePath The storage path prefix to list the contents
   *   of.
   */
  [CAT_LIST, 'listPathPrefix', ['storagePath', TYPE_PATH]],

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
   * A `whenPathAbsent` operation. This is a wait operation that blocks the
   * transaction until a specific path _does not_ have any data stored.
   *
   * @param {string} storagePath The storage path to observe.
   */
  [CAT_WAIT, 'whenPathAbsent', ['storagePath', TYPE_PATH]],

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
   * A `whenPathPresent` operation. This is a wait operation that blocks the
   * transaction until a specific path has some data (any value) stored.
   *
   * @param {string} storagePath The storage path to observe.
   */
  [CAT_WAIT, 'whenPathPresent', ['storagePath', TYPE_PATH]],

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
];

/**
 * {Map<string,object>} Map from operation name to corresponding properties
 * object, suitable for returning from {@link FileOp.propsFromName}.
 */
const OPERATION_MAP = new Map(OPERATIONS.map((schema) => {
  const [category, name, ...args] = schema;
  const isPull = (category === CAT_READ) || (category === CAT_LIST);
  const isPush = (category === CAT_WRITE) || (category === CAT_DELETE);

  const props = { category, name, args, isPull, isPush };
  return [name, DataUtil.deepFreeze(props)];
}));

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
 * * Path lists &mdash; A path list finds or identifies some number of storage
 *   paths, yielding the paths themselves (and not the data so referenced).
 * * Data reads &mdash; A data read gets the value of a blob within a file.
 * * Data deletions &mdash; A data deletion erases previously-existing data
 *   within a file.
 * * Data writes &mdash; A data write stores new data into a file.
 * * Waits &mdash; A wait operation blocks a transaction until some condition
 *   holds. When a wait operation completes having detected one or more
 *   conditions, the paths related to the conditions that were satisfied are
 *   yielded in the results from the transaction. **Note:** If a transaction
 *   includes any wait operations, it must not perform any lists, reads,
 *   deletes, or writes. If a transaction includes more than one wait operation,
 *   the transaction will complete when _any_ of the operations' conditions is
 *   satisfied.
 *
 * When executed, the operations of a transaction are effectively performed in
 * order by category; but within a category there is no effective ordering.
 * Specifically, the category ordering is as listed above.
 *
 * There are static methods on this class to construct each named operation,
 * named `op_<name>`. See documentation on those methods for details about the
 * meaning and arguments of each of these.
 */
export default class FileOp extends CommonBase {
  /** {string} Operation category for deletion ops. */
  static get CAT_DELETE() {
    return CAT_DELETE;
  }

  /** {string} Operation category for environment ops. */
  static get CAT_ENVIRONMENT() {
    return CAT_ENVIRONMENT;
  }

  /** {string} Operation category for path lists. */
  static get CAT_LIST() {
    return CAT_LIST;
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

  /** {array<string>} List of all operation names. This is a frozen value. */
  static get OPERATION_NAMES() {
    return Object.freeze([...OPERATION_MAP.keys()]);
  }

  /** {string} Type name for a `FrozenBuffer`. */
  static get TYPE_BUFFER() {
    return TYPE_BUFFER;
  }

  /** {string} Type name for a millisecond-accuracy duration. */
  static get TYPE_DUR_MSEC() {
    return TYPE_DUR_MSEC;
  }

  /**
   * {string} Type name for hash values. Arguments of this type will also
   * accept instances of `FrozenBuffer`. When given a buffer, the constructor
   * automatically converts it to its hash.
   */
  static get TYPE_HASH() {
    return TYPE_HASH;
  }

  /**
   * {string} Type name for index values, which is to say non-negative integers.
   * These are used to with the `*Range` operations.
   */
  static get TYPE_INDEX() {
    return TYPE_INDEX;
  }

  /** {string} Type name for storage paths. */
  static get TYPE_PATH() {
    return TYPE_PATH;
  }

  /** {string} Type name for revision numbers. */
  static get TYPE_REV_NUM() {
    return TYPE_REV_NUM;
  }

  /**
   * Gets the properties associated with a given operation, by name. Properties
   * are as follows:
   *
   * * `args: array` &mdash; One or more elements indicating the names and types
   *   of the arguments to the operation. Each argument is represented as a
   *   two-element array `[<name>, <type>]`, where `<type>` is one of the type
   *   constants defined by this class.
   * * `category: string` &mdash; Operation category.
   * * `isPull: boolean` &mdash; Whether the operation is a pull (category
   *   `read` or `list`).
   * * `isPush: boolean` &mdash; Whether the operation is a push (category
   *   `write` or `delete`).
   * * `name: string` &mdash; Operation name. (This is the same as the passed
   *   `name`.)
   *
   * @param {string} name Operation name.
   * @returns {object} Operation properties.
   */
  static propsFromName(name) {
    const schema = OPERATION_MAP.get(name);

    if (!schema) {
      throw Errors.bad_value(name, 'FileOp operation name');
    }

    return schema;
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
      case CAT_LIST:
      case CAT_PREREQUISITE:
      case CAT_READ:
      case CAT_REVISION:
      case CAT_WAIT:
      case CAT_WRITE: {
        return category;
      }
      default: {
        throw Errors.bad_value(category, 'category string');
      }
    }
  }

  /**
   * Constructs an instance. This should not be used directly. Instead use the
   * static constructor methods defined by this class.
   *
   * @param {string} name The operation name.
   * @param {...*} args Arguments to the operation.
   */
  constructor(name, ...args) {
    // This validates `name`.
    const opProps = FileOp.propsFromName(name);

    // This both validates and modifies `args`.
    FileOp._fixArgs(opProps, args);

    super();

    /** {object} Properties of the _operation_. */
    this._opProps = opProps;

    /** {array<*>} Arguments to the operation. */
    this._args = args;

    Object.freeze(this);
  }

  /** {string} The operation category. */
  get category() {
    return this._opProps.category;
  }

  /** {string} The operation name. */
  get name() {
    return this._opProps.name;
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * plain object. `opName` is always bound to the operation name, and
   * `category` to the category. Other bindings depend on the operation name.
   * Guaranteed to be a frozen (immutable) object.
   */
  get props() {
    const { args: argInfo, category, name: opName } = this._opProps;
    const args   = this._args;
    const result = { category, opName };

    for (let i = 0; i < argInfo.length; i++) {
      const [name, type_unused] = argInfo[i];
      result[name] = args[i];
    }

    return Object.freeze(result);
  }

  /**
   * Custom inspect function to provide a more succinct representation than the
   * default.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth, opts) {
    const clazz   = this.constructor;
    const nameStr = `${clazz.name}.op_${this.name}`;

    if (depth < 0) {
      return `${nameStr}(...)`;
    }

    // Set up the inspection opts so that recursive `inspect()` calls respect
    // the topmost requested depth.
    const subOpts = (opts.depth === null)
      ? opts
      : Object.assign({}, opts, { depth: opts.depth - 1 });

    const result = [nameStr];
    for (const a of this._args) {
      result.push((result.length === 1) ? '(' : ', ');
      result.push(inspect(a, subOpts));
    }
    result.push(')');

    return result.join('');
  }

  /**
   * Based on the set of defined operations, add `static` constructor methods to
   * this class. This method is called during class initialization. (Look at
   * the bottom of this file for the call.)
   */
  static _addConstructorMethods() {
    for (const opName of FileOp.OPERATION_NAMES) {
      FileOp[`op_${opName}`] = (...args) => {
        return new FileOp(opName, ...args);
      };
    }
  }

  /**
   * Checks that the given value has the given type, as defined by this class.
   * Returns the value to use as an argument, which _might_ be different than
   * the one passed in. Throws an error if the type check fails.
   *
   * @param {*} value Value to check.
   * @param {string} type Expected type, in the form of a `TYPE_*` string as
   *   defined by this class.
   * @returns {*} The value to use.
   */
  static _fixArg(value, type) {
    switch (type) {
      case TYPE_BUFFER: {
        FrozenBuffer.check(value);
        break;
      }

      case TYPE_DUR_MSEC: {
        TInt.nonNegative(value);
        break;
      }

      case TYPE_HASH: {
        if (value instanceof FrozenBuffer) {
          value = value.hash;
        } else {
          FrozenBuffer.checkHash(value);
        }
        break;
      }

      case TYPE_INDEX: {
        TInt.nonNegative(value);
        break;
      }

      case TYPE_PATH: {
        StoragePath.check(value);
        break;
      }

      case TYPE_REV_NUM: {
        TInt.nonNegative(value);
        break;
      }

      default: {
        // Indicates a bug in this class.
        throw Errors.wtf(`Weird \`type\` constant: ${type}`);
      }
    }

    return value;
  }

  /**
   * Checks and "fixes" the given array, for use as arguments to the indicated
   * op. This modifies `args`, including freezing it.
   *
   * @param {object} opProps Operation properties.
   * @param {array<*>} args Operation arguments.
   */
  static _fixArgs(opProps, args) {
    const { args: argInfo, name } = opProps;

    if (args.length !== argInfo.length) {
      throw Errors.bad_use(`Wrong argument count for op \`${name}\`; expected ${argInfo.length}.`);
    }

    for (let i = 0; i < argInfo.length; i++) {
      const [name_unused, type] = argInfo[i];
      args[i] = FileOp._fixArg(args[i], type);
    }

    Object.freeze(args);
  }
}

// Build and bind all the static constructor methods.
FileOp._addConstructorMethods();
