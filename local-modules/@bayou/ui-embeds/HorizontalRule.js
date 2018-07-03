// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Editor } from '@bayou/config-client';

const Embed = Editor.Quill.import('blots/block/embed');

/**
 * A simple leaf blot to implement horizontal rules in Quill.
 */
export default class HorizontalRule extends Embed {
  // <hr> has no properties or actions so this space intentionally
  // left blank.
}

HorizontalRule.blotName = 'horizontalrule';
HorizontalRule.tagName = 'hr';

Editor.Quill.register(HorizontalRule);
