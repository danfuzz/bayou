// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BodyDelta, BodyOp } from '@bayou/doc-common';
import { BodyDeltaHtml } from '@bayou/doc-server';

describe('@bayou/doc-server/BodyDeltaHtml', () => {
  describe('toHtmlForm()', () => {
    it('should produce HTML string', () => {
      function test(ops, expectedHtml) {
        const delta = new BodyDelta(ops);
        const result = BodyDeltaHtml.toHtmlForm(delta);

        assert.deepEqual(result, expectedHtml);
      }

      test([], '');
      test([BodyOp.op_embed('image', 'https://www.fakeimage.com')],
        '<p><img class="ql-image" src="https://www.fakeimage.com"/></p>');
      test([
        BodyOp.op_text('text and image'),
        BodyOp.op_embed('image', 'https://www.fakeimage.com')
      ], '<p>text and image<img class="ql-image" src="https://www.fakeimage.com"/></p>');
      test([BodyOp.op_text('text')], '<p>text</p>');
      test([BodyOp.op_text('bold text', { bold: true })], '<p><strong>bold text</strong></p>');
    });
  });
});
