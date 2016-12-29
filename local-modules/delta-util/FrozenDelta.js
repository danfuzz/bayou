// Copyright 2016 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

/**
 * Make a deep-frozen clone of the given object, or return the object itself
 * if it is already deep-frozen. Assumes that the given object started out as
 * JSON; in particular, assumes arrays don't have extra properties, does not
 * expect objects to have "interesting" prototypes, and does not expect to be
 * given functions.
 */
function deepFreeze(obj) {
  if (typeof obj !== 'object') {
    return obj;
  }

  let newObj = obj;
  let any = false; // Becomes `true` the first time a change is made.

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const oldValue = obj[i];
      const newValue = deepFreeze(oldValue);
      if (oldValue !== newValue) {
        if (!any) {
          newObj = obj.slice(); // Clone the array.
          any = true;
        }
        newObj[i] = newValue;
      }
    }
  } else {
    for (let k in obj) {
      const oldValue = obj[k];
      const newValue = deepFreeze(oldValue);
      if (oldValue !== newValue) {
        if (!any) {
          newObj = Object.assign({}, obj); // Clone the object.
          any = true;
        }
        newObj[k] = newValue;
      }
    }
  }

  Object.freeze(newObj);
  return newObj;
}

/**
 * Always-frozen `Delta`.
 */
export default class FrozenDelta extends Delta {
  /**
   * Constructs an instance.
   *
   * @param ops The transformation operations of this instance. If not deeply
   * frozen, the actual stored `ops` will be a deep-frozen clone of the given
   * value.
   */
   constructor(ops) {
     if (!Array.isArray(ops)) {
       throw new Error('Bad value for `ops`.');
     }

     super(deepFreeze(ops));
     Object.freeze(this);
   }
}
