// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import GraphemeSplitter from 'grapheme-splitter';

import { TInt, TString } from 'typecheck';
import { UtilityClass } from 'util-common-base';

/**
 * Several (hopefully) useful routines to make dealing with strings (especially some
 * of the finer points of dealing with Unicdode) a little nicer.
 */
export default class StringUtil extends UtilityClass {
  /*
   * Splits a string into its distinct grapheme clusters. For instance, the letter
   * 'ñ' could be represented as the single Unicode code point `0x00F1`, or as the
   * the letter 'n' (`0x63`) plus the '~' combinding mark (`0x0303`). The built-in
   * splitting routines for JavaScript strings do not take care to not split the string
   * in the middle of such clusters. The function knows about combining marks,
   * surrogate pairs, etc.
   *
   * @param {string} string The string to split.
   * @returns {array<string>} An array of strings, one for each grapheme cluster in the input.
   */
  static graphemesForString(string) {
    const splitter = new GraphemeSplitter();

    return splitter.splitGraphemes(string);
  }

  /**
   * Calculates the number of bytes needed to represent the input as UTF-8.
   *
   * @param {string} string The string to encode and tally.
   * @returns {Int} The count of bytes needed to encode the input as UTF-8.
   */
  static utf8LengthForString(string) {
    return Buffer.byteLength(string, 'utf-8');
  }

  /**
   * Takes a string and trims grapheme clusters off of its end until the new string whose
   * UTF-8-encoded form is less than, or equal to, a given number of bytes.
   *
   * @param {string} string The string to trim.
   * @param {Int} limit The upper limit (inclusive) for the output counted as UTF-8 bytes.
   * @returns {string} The trimmed string.
   */
  static stringWithUtf8ByteLimit(string, limit) {
    TString.check(string);
    TInt.min(limit, 0);

    let resultString = '';
    let totalByteCount = 0;
    const graphemes = StringUtil.graphemesForString(string);

    // Add grapheme clusters to the output, one at a time, until doing so would make a string whose
    // UTF-8 encoded form would excede the limit.
    for (const grapheme of graphemes) {
      const graphemeByteCount = Buffer.byteLength(grapheme, 'utf-8');

      if (graphemeByteCount + totalByteCount > limit) {
        break;
      }

      resultString += grapheme;
      totalByteCount += graphemeByteCount;
    }

    return resultString;
  }
}
