// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FrozenBuffer } from '@bayou/util-core';

/**
 * {array<string>} List of string test cases meant to cover a good swath of test
 * territory.
 */
const STRING_CASES = [
  '',
  'florp',
  '\u0001',
  'I 😍 U.',
  'á',
  '⣿',
  '😀'
];

/** {array<string>} List of valid hash values. */
const VALID_HASHES = [
  '=sha3_0_0000000011111111222222223333333300000000111111112222222233333333',
  '=sha3_1_0000000011111111222222223333333300000000111111112222222233333333',
  '=sha3_9abcdef_0000000011111111222222223333333300000000111111112222222233333333',
  '=sha3_123abc_00000000123456782222222233333333000000001111111122222222abcdef99'
];

/** {array<string>} List of invalid hash values. */
const INVALID_HASHES = [
  // Totally wrong syntax.
  '',
  '1234',
  'sha3_1234',
  'florp_like',
  'sha3_1234_0000000011111111222222223333333300000000111111112222222233333333',

  // Missing `=` sigil.
  'sha3_123abc_00000000123456782222222233333333000000001111111122222222abcdef99',

  // Wrong field separator.
  '=sha3-123abc-00000000123456782222222233333333000000001111111122222222abcdef99',

  // Uppercase hex.
  '=sha3-123ABC-00000000123456782222222233333333000000001111111122222222abcdef99',
  '=sha3_123abc_00000000123456782222222233333333000000001111111122222222ABCDEF99',

  // Unsupported algorithm.
  '=blort_1234_0000000011111111222222223333333300000000111111112222222233333333',

  // Length of hash too long.
  '=sha3_123456789_0000000011111111222222223333333300000000111111112222222233333333',

  // Zero-prefixed length field.
  '=sha3_01_0000000011111111222222223333333300000000111111112222222233333333'
];

/** {array<*>} List of non-string values. */
const NON_STRINGS = [
  null,
  undefined,
  false,
  true,
  123.456,
  [],
  ['/hello'],
  {},
  { '/x': '/y' }
];

describe('@bayou/util-core/FrozenBuffer', () => {
  describe('checkHash()', () => {
    it('accepts valid hash strings', () => {
      for (const value of VALID_HASHES) {
        assert.strictEqual(FrozenBuffer.checkHash(value), value);
      }
    });

    it('rejects invalid hash strings', () => {
      for (const value of INVALID_HASHES) {
        assert.throws(() => { FrozenBuffer.checkHash(value); });
      }
    });

    it('rejects non-strings', () => {
      for (const value of NON_STRINGS) {
        assert.throws(() => { FrozenBuffer.checkHash(value); });
      }
    });
  });

  describe('isHash()', () => {
    it('returns `true` for valid hash strings', () => {
      for (const value of VALID_HASHES) {
        assert.isTrue(FrozenBuffer.isHash(value), value);
      }
    });

    it('rejects invalid hash strings', () => {
      for (const value of INVALID_HASHES) {
        assert.isFalse(FrozenBuffer.isHash(value), value);
      }
    });

    it('rejects non-strings', () => {
      for (const value of NON_STRINGS) {
        assert.isFalse(FrozenBuffer.isHash(value), value);
      }
    });
  });

  describe('constructor()', () => {
    describe('invalid arguments', () => {
      it('throws an error if the first argument is anything other than a string or `Buffer`', () => {
        assert.throws(() => new FrozenBuffer(1));
        assert.throws(() => new FrozenBuffer(true));
        assert.throws(() => new FrozenBuffer(null));
        assert.throws(() => new FrozenBuffer(['hello']));
        assert.throws(() => new FrozenBuffer({ a: 10 }));

        assert.throws(() => new FrozenBuffer(1, 'utf8'));
        assert.throws(() => new FrozenBuffer(1, 'base64'));
      });
    });

    describe('constructor(string, \'utf8\')', () => {
      it('accepts valid arguments', () => {
        assert.doesNotThrow(() => new FrozenBuffer(''));
        assert.doesNotThrow(() => new FrozenBuffer('hello'));
        assert.doesNotThrow(() => new FrozenBuffer('florp', 'utf8'));
      });

      it('converts strings to bytes using UTF-8 encoding', () => {
        function test(string) {
          const buf = new FrozenBuffer(string);
          const nodeBuf = Buffer.from(string, 'utf8');
          assert.deepEqual(buf.toBuffer(), nodeBuf);
        }

        for (const s of STRING_CASES) {
          test(s);
        }
      });

      it('treats a missing second argument as having passed `utf-8`', () => {
        function test(string) {
          const buf1 = new FrozenBuffer(string);
          const buf2 = new FrozenBuffer(string, 'utf8');
          assert.deepEqual(buf1.toBuffer(), buf2.toBuffer());
        }

        for (const s of STRING_CASES) {
          test(s);
        }
      });
    });

    describe('constructor(string, \'base64\')', () => {
      it('accepts valid arguments', () => {
        assert.doesNotThrow(() => new FrozenBuffer('', 'base64'));
        assert.doesNotThrow(() => new FrozenBuffer('RkxPUlAK', 'base64'));
      });

      it('produces bytes identical to the expected base-64 decoding', () => {
        function test(string) {
          const nodeBuf = Buffer.from(string, 'utf8');
          const base64  = nodeBuf.toString('base64');
          const buf     = new FrozenBuffer(base64, 'base64');
          assert.deepEqual(buf.toBuffer(), nodeBuf);
        }

        for (const s of STRING_CASES) {
          test(s);
        }
      });
    });

    describe('constructor(Buffer)', () => {
      it('accepts valid arguments', () => {
        assert.doesNotThrow(() => new FrozenBuffer(Buffer.from('')));
        assert.doesNotThrow(() => new FrozenBuffer(Buffer.alloc(100, 123)));
      });

      it('converts bytes to strings using UTF-8 encoding', () => {
        function test(string) {
          const nodeBuf = Buffer.from(string, 'utf8');
          const buf     = new FrozenBuffer(nodeBuf);
          assert.strictEqual(buf.string, string);
        }

        for (const s of STRING_CASES) {
          test(s);
        }
      });

      it('does not share the original buffer data; should be a copy', () => {
        const nodeBuf1 = Buffer.from('blortch', 'utf8');
        const nodeBuf2 = Buffer.from(nodeBuf1);
        const buf      = new FrozenBuffer(nodeBuf1);

        nodeBuf1[0] = 0;
        nodeBuf1[1] = 0;
        nodeBuf1[2] = 0;

        assert.strictEqual(buf.string, 'blortch');
        assert.deepEqual(buf.toBuffer(), nodeBuf2);
      });
    });
  });

  describe('.base64', () => {
    it('is as expected when originally constructed from a `Buffer`', () => {
      const buf = new FrozenBuffer(Buffer.from('florp splat', 'utf8'));
      assert.strictEqual(buf.base64, 'ZmxvcnAgc3BsYXQ=');
    });

    it('is as expected when originally constructed from a UTF-8 string', () => {
      const buf = new FrozenBuffer('blort splat florp');
      assert.strictEqual(buf.base64, 'YmxvcnQgc3BsYXQgZmxvcnA=');
    });

    it('is as expected when originally constructed from a base-64 string', () => {
      const base64 = 'ZmxvcnAgc3BsYXQ=';
      const buf = new FrozenBuffer(base64, 'base64');
      assert.strictEqual(buf.base64, base64);
    });
  });

  describe('.hashLength', () => {
    it('is `256`', () => {
      assert.strictEqual(new FrozenBuffer('x').hashLength, 256);
    });
  });

  describe('.hashName', () => {
    it('is `sha3`', () => {
      assert.strictEqual(new FrozenBuffer('x').hashName, 'sha3');
    });
  });

  describe('.hash', () => {
    it('is a 256 SHA-3 with length, in the prescribed format', () => {
      // **Note:** You can validate this result via the command-line `openssl`
      // tool: `printf '<data>' | openssl dgst -sha256`
      const data = 'This is the most important data you have ever observed.';
      const expected = '=sha3_37_0a0dd2a860af2422778911afa63c1cae54d425db402d73415cc7060d99179f3a';
      const buf = new FrozenBuffer(data);

      assert.strictEqual(buf.hash, expected);
    });
  });

  describe('.length', () => {
    it('is the expected length from a Buffer', () => {
      const buf = new FrozenBuffer(Buffer.alloc(9000));
      assert.strictEqual(buf.length, 9000);
    });

    it('is the expected length from a UTF-8 string', () => {
      assert.strictEqual(new FrozenBuffer('12345').length, 5);

      // Because of UTF-8 encoding.
      assert.strictEqual(new FrozenBuffer('á').length, 2);
      assert.strictEqual(new FrozenBuffer('⣿').length, 3);
      assert.strictEqual(new FrozenBuffer('😀').length, 4);
    });
  });

  describe('.string', () => {
    it('is the same string given in the UTF-8 string constructor', () => {
      function test(string) {
        const buf = new FrozenBuffer(string);
        assert.strictEqual(buf.string, string);
      }

      for (const s of STRING_CASES) {
        test(s);
      }
    });

    it('is the UTF-8 decoding of the Buffer given in the constructor', () => {
      function test(string) {
        const nodeBuf = Buffer.from(string, 'utf8');
        const buf = new FrozenBuffer(nodeBuf);
        assert.strictEqual(buf.string, string);
      }

      for (const s of STRING_CASES) {
        test(s);
      }
    });
  });

  describe('copy()', () => {
    it('defaults to copying all data', () => {
      const buf = new FrozenBuffer('12345');
      const nodeBuf = Buffer.alloc(5);

      buf.copy(nodeBuf);
      assert.deepEqual(nodeBuf, buf.toBuffer());
    });

    it('should let the target start index be specified', () => {
      const buf = new FrozenBuffer('12345');
      const nodeBuf = Buffer.alloc(5);

      nodeBuf[0] = 0x78;
      buf.copy(nodeBuf, 1);
      assert.strictEqual(nodeBuf.toString('utf8'), 'x1234');
    });

    it('should let the target and source start indexes be specified', () => {
      const buf = new FrozenBuffer('12345');
      const nodeBuf = Buffer.alloc(5);

      nodeBuf[0] = 0x78;
      nodeBuf[4] = 0x78;
      buf.copy(nodeBuf, 1, 2);
      assert.strictEqual(nodeBuf.toString('utf8'), 'x345x');
    });

    it('should let the target, source start, and source end indexes be specified', () => {
      const buf = new FrozenBuffer('12345');
      const nodeBuf = Buffer.alloc(5);

      nodeBuf[0] = 0x78;
      nodeBuf[1] = 0x78;
      nodeBuf[4] = 0x78;
      buf.copy(nodeBuf, 2, 1, 3);
      assert.strictEqual(nodeBuf.toString('utf8'), 'xx23x');
    });
  });

  describe('equals()', () => {
    it('should consider identically-constructed instances to be equal', () => {
      function test(string) {
        const buf1 = new FrozenBuffer(string);
        const buf2 = new FrozenBuffer(string);
        assert.isTrue(buf1.equals(buf2));

        const buf3 = new FrozenBuffer(buf1.toBuffer());
        const buf4 = new FrozenBuffer(buf2.toBuffer());
        assert.isTrue(buf3.equals(buf4));

        assert.isTrue(buf1.equals(buf3));
      }

      for (const s of STRING_CASES) {
        test(s);
      }
    });

    it('should consider differently-constructed instances to be inequal', () => {
      assert.isFalse(new FrozenBuffer('').equals(new FrozenBuffer('x')));
      assert.isFalse(new FrozenBuffer('a').equals(new FrozenBuffer('b')));
      assert.isFalse(new FrozenBuffer('aa').equals(new FrozenBuffer('ab')));
    });
  });

  describe('toBuffer()', () => {
    it('is a buffer with the same contents as given in the constructor', () => {
      const nodeBuf = Buffer.alloc(9000);

      for (let i = 0; i < nodeBuf.length; i++) {
        nodeBuf[i] = i & 0xff;
      }

      const buf = new FrozenBuffer(nodeBuf);
      const result = buf.toBuffer();

      assert.notStrictEqual(result, nodeBuf);
      assert.deepEqual(result, nodeBuf);
    });

    it('is the UTF-8 encoding of the string given in the UTF-8 string constructor', () => {
      function test(string) {
        const buf = new FrozenBuffer(string);
        const nodeBuf = Buffer.from(string, 'utf8');
        assert.deepEqual(buf.toBuffer(), nodeBuf);
      }

      for (const s of STRING_CASES) {
        test(s);
      }
    });

    it('is independent of the internally-stored buffer and to other results from this method', () => {
      const nodeBuf = Buffer.from('abc', 'utf8');
      const origBuf = new FrozenBuffer(nodeBuf);
      const toBuf1  = origBuf.toBuffer();

      toBuf1[0] = 0;
      toBuf1[1] = 0;
      toBuf1[2] = 0;

      const toBuf2  = origBuf.toBuffer();

      assert.notStrictEqual(toBuf2, toBuf1);
      assert.deepEqual(toBuf2, nodeBuf);
    });
  });
});
