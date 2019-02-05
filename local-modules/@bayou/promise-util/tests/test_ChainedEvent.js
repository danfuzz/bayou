// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ChainedEvent, Delay, EventSource } from '@bayou/promise-util';
import { Functor } from '@bayou/util-common';

describe('@bayou/promise-util/ChainedEvent', () => {
  describe('constructor()', () => {
    it('constructs an instance', async () => {
      const source = new EventSource();
      assert.doesNotThrow(() => new ChainedEvent(source, new Functor('blort')));
    });
  });

  describe('.next', () => {
    it('is an unresolved promise if there is no next event', async () => {
      const source = new EventSource();
      const event  = source.emit.blort();

      const race = await Promise.race([event.next, Delay.resolve(10, 123)]);
      assert.strictEqual(race, 123);
    });

    it('eventually resolves to the chained event', async () => {
      const source = new EventSource();
      const event  = source.emit.blort();

      const next = event.next;
      await Delay.resolve(10);
      source.emit.florp();
      const got = await next;
      assert.strictEqual(got.payload.name, 'florp');
    });
  });

  describe('.nextNow', () => {
    it('is `null` if there is no next event', () => {
      const source = new EventSource();
      const event  = source.emit.blort();

      assert.isNull(event.nextNow);
    });

    it('is the next event once emitted', () => {
      const source = new EventSource();
      const event  = source.emit.blort();

      source.emit.florp();
      assert.strictEqual(event.nextNow.payload.name, 'florp');
    });
  });

  describe('withNewPayload()', () => {
    it('produces an instance with the indicated payload', () => {
      const source = new EventSource();
      const event  = source.emit.blort();
      const expect = new Functor('florp');

      const result = event.withNewPayload(expect);
      assert.strictEqual(result.payload, expect);
    });

    it('produces an instance whose `nextNow` tracks the original', async () => {
      const source = new EventSource();
      const event  = source.emit.blort();
      const result = event.withNewPayload(new Functor('florp'));

      assert.isNull(result.nextNow);
      source.emit.like();
      assert.strictEqual(event.nextNow.payload.name, 'like');

      // The result is allowed to (and expected to) asynchronously update
      // `nextNow`. We can only count on it being set after `next` resolves.
      await result.next;

      assert.strictEqual(result.nextNow.payload.name, 'like');
    });

    it('produces an instance whose `next` tracks the original', async () => {
      const source = new EventSource();
      const event  = source.emit.blort();
      const result = event.withNewPayload(new Functor('florp'));

      const race = await Promise.race([result.next, Delay.resolve(10, 123)]);
      assert.strictEqual(race, 123);

      source.emit.like();
      const eventNext  = await event.next;
      const resultNext = await result.next;
      assert.strictEqual(eventNext.payload.name, 'like');
      assert.strictEqual(resultNext.payload.name, 'like');
    });
  });

  describe('withPushedHead()', () => {
    it('produces an instance with the default payload', () => {
      const source = new EventSource();
      const event  = source.emit.blort(1, 2, 3);
      const result = event.withPushedHead();

      assert.strictEqual(result.payload.name, 'none');
      assert.strictEqual(result.payload.args.length, 0);
    });
  });

  describe('withPushedHead(payload)', () => {
    it('produces an instance with the indicated payload', () => {
      const source = new EventSource();
      const event  = source.emit.blort(1, 2, 3);
      const expect = new Functor('florp', 'x');
      const result = event.withPushedHead(expect);

      assert.strictEqual(result.payload, expect);
    });

    it('produces an instance with `next` bound a promise to the original event', async () => {
      const source = new EventSource();
      const event  = source.emit.blort(1, 2, 3);
      const result = event.withPushedHead(new Functor('florp'));

      const next = await result.next;
      assert.strictEqual(next, event);
    });

    it('produces an instance with `nextNow` bound to the original event', () => {
      const source = new EventSource();
      const event  = source.emit.blort(1, 2, 3);
      const result = event.withPushedHead(new Functor('florp'));

      assert.strictEqual(result.nextNow, event);
    });
  });
});
