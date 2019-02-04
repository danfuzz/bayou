// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { EventEmitter } from 'events';
import { describe, it } from 'mocha';

import { Delay, EventSource } from '@bayou/promise-util';
import { Functor } from '@bayou/util-common';

describe('@bayou/promise-util/EventSource', () => {
  describe('constructor()', () => {
    it('trivially appears to work', async () => {
      assert.doesNotThrow(() => new EventSource());
    });
  });

  describe('.currentEvent', () => {
    it('is an unresolved promise if no events have ever been emitted', async () => {
      const source = new EventSource();
      const currentEvent = source.currentEvent;

      const race = await Promise.race([currentEvent, Delay.resolve(10, 123)]);
      assert.strictEqual(race, 123);
    });

    it('resolves to the first emitted event if no events have ever been emitted', async () => {
      const source = new EventSource();
      const currentEvent = source.currentEvent;

      await Delay.resolve(100);
      source.emit(new Functor('blort'));
      const got = await currentEvent;
      assert.strictEqual(got.payload.name, 'blort');
    });

    it('resolves to the most recently emitted event', async () => {
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
    it('is `null` if no events have ever been emitted', () => {
      const source = new EventSource();
      assert.isNull(source.currentEventNow);
    });

    it('is the most recently emitted event if there were ever any emitted events', () => {
      const source = new EventSource();

      source.emit(new Functor('blort'));
      source.emit(new Functor('florp'));
      assert.strictEqual(source.currentEventNow.payload.name, 'florp');
      source.emit(new Functor('like'));
      assert.strictEqual(source.currentEventNow.payload.name, 'like');
    });
  });

  describe('.emitter', () => {
    it('is an instance of `EventEmitter`', () => {
      const source = new EventSource();
      assert.instanceOf(source.emitter, EventEmitter);
    });

    it('can be listened to and receive an emitted event', () => {
      const source   = new EventSource();
      const emitter  = source.emitter;
      let   listened = 0;
      let   gotArgs  = null;

      function listener(...args) {
        listened++;
        gotArgs = args;
      }

      emitter.addListener('blort', listener);
      source.emit(new Functor('blort', 1, 2, 3));

      assert.strictEqual(listened, 1);
      assert.deepEqual(gotArgs, [1, 2, 3]);
    });

    it('cannot be used directly to emit events', () => {
      const source   = new EventSource();
      const emitter  = source.emitter;

      assert.throws(() => emitter.emit('blort', 1, 2, 3), /badUse/);
    });
  });

  describe('emit()', () => {
    it('trivially appears to work', () => {
      const source = new EventSource();
      assert.doesNotThrow(() => { source.emit(new Functor('blort')); });
    });
  });
});
