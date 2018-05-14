// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ErrorUtil } from '@bayou/util-common';

describe('@bayou/util-common/ErrorUtil', () => {
  describe('stackLines(error)', () => {
    it('should return an array of strings', () => {
      const result = ErrorUtil.stackLines(new Error('oy'));

      assert.isArray(result);
      for (const line of result) {
        assert.isString(line);
      }
    });
  });

  describe('stackLines(error, indent)', () => {
    it('should return an array of strings, each with the specified indentation', () => {
      const result = ErrorUtil.stackLines(new Error('oy\nyo'), '123');

      assert.isArray(result);
      for (const line of result) {
        assert.isString(line);
        assert.isTrue(line.startsWith('123'));
      }
    });
  });

  describe('fullTraceLines(error)', () => {
    it('should return an array of strings', () => {
      const result = ErrorUtil.fullTraceLines(new Error('oy'));

      assert.isArray(result);
      for (const line of result) {
        assert.isString(line);
      }
    });

    it('should have a first line that indicates the name and message', () => {
      function test(value, expect) {
        const result = ErrorUtil.fullTraceLines(value);
        assert.strictEqual(result[0], expect);
      }

      test(new Error('oy'), 'Error: oy');

      const error2 = new Error('florp');
      error2.name  = 'Blort';
      test(error2, 'Blort: florp');

      const error3 = new Error('bar');
      error3.name  = 'Foo';
      error3.cause = error2;
      test(error3, 'Foo: bar');
    });

    it('should split a multi-line name and/or message into separate result elements', () => {
      const error = new Error('what\nis\nhappening?');
      error.name = 'Who\nWhat';

      const result = ErrorUtil.fullTraceLines(error);
      const expect = ['Who', 'What: what', 'is', 'happening?'];

      for (let i = 0; i < expect.length; i++) {
        assert.strictEqual(result[i], expect[i]);
      }
    });

    it('should have lines that indicate extra properties', () => {
      function test(value, expect) {
        const result = ErrorUtil.fullTraceLines(value);
        let   found  = false;

        for (const line of result) {
          if (line === expect) {
            found = true;
            break;
          }
        }

        assert.isTrue(found);
      }

      const error = new Error('x');
      error.a = 10;
      error.b = 'twenty';
      test(error, '  { a: 10, b: \'twenty\' }');
    });

    it('should represent the cause if present', () => {
      function test(value, ...expect) {
        const result = ErrorUtil.fullTraceLines(value);
        let at = 0;

        for (const line of result) {
          if (line === expect[at]) {
            at++;
            if (at === expect.length) {
              break;
            }
          }
        }

        assert.strictEqual(at, expect.length);
      }

      const error1 = new Error('x');
      error1.cause = new Error('y');
      test(error1,
        '  caused by:',
        '  Error: y'
      );

      const error2 = new Error('x');
      error2.florp = 'whatevs';
      error2.cause = new Error('zorch');
      error2.cause.name  = 'Zorch';
      error2.cause.florp = 'like';
      test(error2,
        '  caused by:',
        '  Zorch: zorch',
        '    { florp: \'like\' }'
      );

      const error3 = new Error('quux');
      error3.cause = error2;
      test(error3,
        '  caused by:',
        '  Error: x',
        '    { florp: \'whatevs\' }',
        '  caused by:',
        '  Zorch: zorch',
        '    { florp: \'like\' }'
      );
    });
  });

  describe('fullTraceLines(error, indent)', () => {
    it('should return an array of strings, each with the specified indentation', () => {
      const error = new Error('oy');
      error.florp = 'like';
      error.cause = new Error('oy_cause');
      error.cause.like = 'florp';

      const result = ErrorUtil.fullTraceLines(error, '123');

      assert.isArray(result);
      for (const line of result) {
        assert.isString(line);
        assert.isTrue(line.startsWith('123'));
      }
    });
  });
});
