// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Delay, EventSource } from 'promise-util';
import { Functor } from 'util-common';

describe('promise-util/EventSource', () => {
  describe('constructor()', () => {
    it('should work', async () => {
      new EventSource();
    });
  });

  describe('.currentEvent', () => {
    it('should be an unresolved promise if no events have ever been emitted', async () => {
      const source = new EventSource();
      const currentEvent = source.currentEvent;

      const race = await Promise.race([currentEvent, Delay.resolve(10, 123)]);
      assert.strictEqual(race, 123);
    });

    it('should eventually resolve to the first emitted event if no events have ever been emitted', async () => {
      const source = new EventSource();
      const currentEvent = source.currentEvent;

      await Delay.resolve(100);
      source.emit(new Functor('blort'));
      const got = await currentEvent;
      assert.strictEqual(got.payload.name, 'blort');
    });

    it('should resolve to the most recently emitted event', async () => {
      const source = new EventSource();
      source.emit(new Functor('blort'));
      source.emit(new Functor('florp'));
      const ce1 = source.currentEvent;
      source.emit(new Functor('like'));
      const ce2 = source.currentEvent;

      const got1 = await ce1;
      const got2 = await ce2;
      assert.strictEqual(got1.payload.name, 'florp');
      assert.strictEqual(got2.payload.name, 'like');
    });
  });

  describe('.currentEventNow', () => {
    it('should be `null` if no events have ever been emitted', () => {
      const source = new EventSource();
      assert.isNull(source.currentEventNow);
    });

    it('should be the most recently emitted event if there were ever any emitted events', () => {
      const source = new EventSource();

      source.emit(new Functor('blort'));
      source.emit(new Functor('florp'));
      assert.strictEqual(source.currentEventNow.payload.name, 'florp');
      source.emit(new Functor('like'));
      assert.strictEqual(source.currentEventNow.payload.name, 'like');
    });
  });

  describe('emit()', () => {
    it('should work', () => {
      const source = new EventSource();
      source.emit(new Functor('blort'));
    });
  });
});
