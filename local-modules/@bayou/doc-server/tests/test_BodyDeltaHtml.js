// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BodyDelta, BodyOp } from '@bayou/doc-common';
import { BodyDeltaHtml } from '@bayou/doc-server';

const expectedCustomOpHtml = 'custom html';
const expectedUnfoundCustomOpHtml = 'custom conversion not found';

function customConverter(customOp) {
  if (customOp.insert.type === 'customTest') {
    return expectedCustomOpHtml;
  }

  return expectedUnfoundCustomOpHtml;
}

function urlParserNoOp(url) {
  return url;
}

function testHtml(ops, expectedHtml) {
  const delta = new BodyDelta(ops);
  const result = BodyDeltaHtml.toHtmlForm(delta, customConverter, { urlSanitizer: urlParserNoOp });

  assert.deepEqual(result, expectedHtml);
}

describe('@bayou/doc-server/BodyDeltaHtml', () => {
  describe('toHtmlForm()', () => {
    it('should produce HTML string', () => {
      testHtml([], '');
      testHtml([BodyOp.op_embed('image', 'https://www.fakeimage.com')],
        '<p><img class="ql-image" src="https://www.fakeimage.com"/></p>');
      testHtml([
        BodyOp.op_text('text and image'),
        BodyOp.op_embed('image', 'https://www.fakeimage.com')
      ], '<p>text and image<img class="ql-image" src="https://www.fakeimage.com"/></p>');
      testHtml([BodyOp.op_text('text')], '<p>text</p>');
      testHtml([BodyOp.op_text('bold text', { bold: true })], '<p><strong>bold text</strong></p>');
    });

    it('should produce expected HTML string of a valid custom op', () => {
      testHtml([BodyOp.op_embed('customTest')], `<p>${expectedCustomOpHtml}</p>`);
    });

    it('should produce expected HTML string when invalid custom op', () => {
      testHtml([BodyOp.op_embed('unregisteredCustomOp')], `<p>${expectedUnfoundCustomOpHtml}</p>`);
    });

    it('should produce non-altered url', () => {
      const unsafeLink = 'test.com';
      testHtml([BodyOp.op_text('unsafe link', { link: unsafeLink })], `<p><a href="${unsafeLink}" target="_blank">unsafe link</a></p>`);
    });
  });
});
