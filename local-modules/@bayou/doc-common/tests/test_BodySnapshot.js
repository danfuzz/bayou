// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import GraphemeSplitter from 'grapheme-splitter';

import { BodyOp, BodySnapshot } from '@bayou/doc-common';

// Instance of the grapheme splitter library
// used to properly count the length of
// special characters, such as emojis.
const splitter = new GraphemeSplitter();

const PLAIN_TEXT = 'plain text';
const PLAIN_TEXT_LENGTH = PLAIN_TEXT.length;
const EMOJI_TEXT = '😀 smile!';
const EMOJI_TEXT_LENGTH = splitter.countGraphemes(EMOJI_TEXT);

const PLAIN_TEXT_OP = BodyOp.op_text(PLAIN_TEXT);
const EMOJI_TEXT_OP = BodyOp.op_text(EMOJI_TEXT);
const EMBED_OP = BodyOp.op_embed('x', 1);

const EMPTY_BODY_SNAPSHOT = new BodySnapshot(0, []);
const PLAIN_TEXT_BODY_SNAPSHOT = new BodySnapshot(0, [PLAIN_TEXT_OP]);
const EMOJI_BODY_SNAPSHOT = new BodySnapshot(0, [EMOJI_TEXT_OP]);
const MIXED_BODY_SNAPSHOT = new BodySnapshot(0, [PLAIN_TEXT_OP, EMOJI_TEXT_OP]);

const EMBED_BODY_SNAPSHOT = new BodySnapshot(0, [EMBED_OP]);
const EMBED_TEXT_BODY_SNAPSHOT = new BodySnapshot(0, [EMBED_OP, EMOJI_TEXT_OP]);

describe('@bayou/doc-common/BodySnapshot', () => {
  describe('.length', () => {
    it('should return 0 for empty body', () => {
      const bodySnapshotLength = EMPTY_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, 0);
    });

    it('should return length of plain text for plain text body', () => {
      const bodySnapshotLength = PLAIN_TEXT_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, PLAIN_TEXT_LENGTH);
    });

    it('should return length of special text for special text body', () => {
      const bodySnapshotLength = EMOJI_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, EMOJI_TEXT_LENGTH);
    });

    it('should return length of total text for mixed text body', () => {
      const bodySnapshotLength = MIXED_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, PLAIN_TEXT_LENGTH + EMOJI_TEXT_LENGTH);
    });

    it('should return 1 for body with one embed', () => {
      const bodySnapshotLength = EMBED_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, 1);
    });

    it('should return 1 + text length for body with one embed and text', () => {
      const bodySnapshotLength = EMBED_TEXT_BODY_SNAPSHOT.length;

      assert.strictEqual(bodySnapshotLength, 1 + EMOJI_TEXT_LENGTH);
    });
  });
});
