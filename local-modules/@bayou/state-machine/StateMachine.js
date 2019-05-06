// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Condition } from '@bayou/promise-util';
import { BaseLogger, Logger } from '@bayou/see-all';
import { TBoolean, TObject, TString } from '@bayou/typecheck';
import { CommonBase, Errors, Functor, PropertyIterable } from '@bayou/util-common';

/**
 * Lightweight state machine framework. This allows a subclass to define
 * handlers for any number of (state, event) pairs, along with default handlers
 * for wildcards on either event or state (or both). Events can be queued up
 * at will and get dispatched asynchronously (each in a separate turn) with
 * respect to the act of enqueueing, in the same order they were enqueued.
 *
 * Event handlers are allowed to be `async` functions, in which case they are
 * serialized such that there is only ever one handler running at a time,
 * including pauses due to handler-internal `await`s. That is, each invoked
 * handler runs to completion before another handler is invoked.
 *
 * The state machine is defined by a set of instance methods defined by
 * subclasses, with particular schematic names:
 *
 * * A method of the form `_check_<name>` is taken to be a validator for the
 *   event with the given name. It is called with the would-be event arguments,
 *   and it should return regularly if the arguments are valid, or throw an
 *   exception if the arguments are somehow invalid. The set of validators in
 *   effect defines the set of valid event names for the instance. If it returns
 *   regularly, it is expected to either return `undefined` or an array; in the
 *   latter case the return value is used as the event arguments instead of the
 *   ones originally supplied.
 *
 * * A method of the form `_handle_<stateName>_<eventName>` is taken to be the
 *   handler for the named event in the named state. It gets called with the
 *   same arguments as passed to the event queue function for the given event
 *   name. The set of states named in these methods defines the set of valid
 *   states for the instance.
 *
 *   As a special case, `any` may be used for either a state name or an event
 *   name (or both) in a handler, which causes the method to be used if there is
 *   no more specific handler. In the case of an `any` event name, the event
 *   name itself is prepended to the event arguments. **Note:** If there are
 *   matching handlers for both (state, any-event) and (any-state, event), then
 *   the former "wins." That is, `_handle_stateName_any()` takes precedence over
 *   `_handle_any_eventName()`.
 *
 * Constructing an instance will cause the instance to have two methods added
 * per named event, `q_<name>` and `p_<name>`, each of which takes any number of
 * arguments and queues up a new event (and does nothing else; e.g. doesn't
 * cause synchronous dispatch of events). `q_*` methods do normal FIFO queueing,
 * and `p_*` methods do LIFO pushing (which can be useful when an event handler
 * wants to guarantee transition to a new state with a known event at the head
 * of the queue).
 *
 * Similarly, a method is added for each state, `s_<name>`, each of which takes
 * no arguments and causes the machine to switch into the so-named state.
 *
 * Lastly (and also similarly), a method is added for each state, `when_<name>`,
 * each of which takes no arguments and returns a promise which becomes resolved
 * the moment the machine switches into the so-named state. (If the machine is
 * already in the named state at the moment of the `when_*` call, the promise is
 * immediately resolved.)
 *
 * This class defines a single event type `error(exception)`, which gets
 * queued up any time a handler throws an otherwise uncaught exception. This
 * class also defines two handlers: (1) a default handler for (any, any), which
 * throws an exception. (2) a default handler for (any, error), which logs the
 * error and aborts the state machine.
 */
export class StateMachine extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} initialState The initial state.
   * @param {BaseLogger|null} [logger = null] Logger to use, or `null` to
   *   use a newly-constructed instance.
   * @param {boolean} [verboseLogging = false] Whether to be chatty in the logs.
   *   `true` is useful for debugging but is arguably too much to leave on on
   *   an ongoing basis.
   */
  constructor(initialState, logger = null, verboseLogging = false) {
    super();

    TString.check(initialState);

    /** {BaseLogger} Logger to use. */
    this._log = (logger === null)
      ? new Logger('state-machine')
      : BaseLogger.check(logger).withAddedContext('sm');

    /** {boolean} Whether to be particularly chatty in the logs. */
    this._verboseLogging = TBoolean.check(verboseLogging);

    /** {string} The name of the current state. Set below. */
    this._stateName = null;

    /**
     * {array<Functor>} Queue of events in need of dispatch. Becomes `null`
     * when the state machine is getting aborted.
     */
    this._eventQueue = [];

    /**
     * {Condition} Condition which is set to `true` whenever the event queue
     * has events in it or when it is time to abort.
     */
    this._anyEventPending = new Condition(false);

    /**
     * {Map<string, Condition>} Map from state names to conditions which
     * become momentarily `true` when transitioning into those states. Populated
     * only as needed.
     */
    this._stateConditions = new Map();

    /** {Int} Count of events handled. Used for logging. */
    this._eventCount = 0;

    /** {Map<string,function>} Map of event names to their validator methods. */
    this._eventValidators = this._makeValidatorMap();

    /**
     * {object<string,object<string, function>>} Two-level map from (state,
     * event) pairs to their respective handler methods.
     */
    this._handlers = this._makeHandlerMap();

    this._addEnqueueMethods();
    this._addStateMethods();

    // We use a state-setting method to set the state, because (a) it implicitly
    // validates that the named state is valid, and (b) it will log (if not
    // squelched).
    this[`s_${initialState}`]();

    // Start servicing the event queue.
    this._serviceEventQueue();
  }

  /** {BaseLogger} The logger that this instance uses. */
  get log() {
    return this._log;
  }

  /** {string} The name of the current state. */
  get state() {
    return this._stateName;
  }

  /**
   * Causes the instance to be in a new state.
   *
   * @param {string} stateName The name of the new state.
   */
  set state(stateName) {
    TString.check(stateName);

    // Rather than recapitulate the logic of changing state, just call through
    // to the appropriate `s_*` method.
    this[`s_${stateName}`]();
  }

  /**
   * Adds to this instance two methods per event name, named `q_<name>` and
   * `p_<name>`, each of which takes any number of arguments and enqueues an
   * event with the associated name and the given arguments. `q_*` methods
   * perform normal FIFO enqueuing, and `p_*` methods perform LIFO pushes (which
   * can be useful for intra-machine communication).
   */
  _addEnqueueMethods() {
    const eventNames = Object.keys(this._eventValidators);

    for (const name of eventNames) {
      const validator = this._eventValidators[name];

      const enqueueOrPush = (enqueue, args) => {
        const validArgs = validator.apply(this, args) || args;

        if ((validArgs !== undefined) && !Array.isArray(validArgs)) {
          throw Errors.badUse(`Invalid validator result (non-array) for \`${name}\`.`);
        }

        if (this._eventQueue === null) {
          throw Errors.badUse('Attempt to send event to an aborted instance.');
        }

        const event = new Functor(name, ...args);

        if (this._verboseLogging) {
          this._log.event.enqueued(event);
        }

        if (enqueue) {
          this._eventQueue.push(event);
        } else {
          this._eventQueue.unshift(event);
        }

        this._anyEventPending.value = true;
      };

      this[`q_${name}`] = (...args) => { enqueueOrPush(true,  args); };
      this[`p_${name}`] = (...args) => { enqueueOrPush(false, args); };
    }
  }

  /**
   * Adds to this instance two methods per state name, named `s_<name>` and
   * `when_<name>`, as described in the class header docs.
   */
  _addStateMethods() {
    const stateNames = Object.keys(this._handlers);
    for (const name of stateNames) {
      this[`s_${name}`] = () => {
        if (this._stateName === name) {
          return;
        }

        if (this._verboseLogging) {
          this._log.event.newState(name);
        }

        this._stateName = name;

        // Trigger the awaiter for the state, if any.
        const condition = this._stateConditions.get(name);
        if (condition) {
          condition.onOff();

          if (this._verboseLogging) {
            this._log.event.triggeredWaiter(name);
          }

          // Remove the condition, because in general, these kinds of state
          // awaiters are used only ephemerally.
          this._stateConditions.delete(name);
        }
      };

      this[`when_${name}`] = async () => {
        if (this._stateName === name) {
          if (this._verboseLogging) {
            this._log.event.immediatelyTriggeredWaiter(name);
          }

          return true;
        } else {
          if (this._verboseLogging) {
            this._log.event.addedWaiter(name);
          }

          let condition = this._stateConditions.get(name);

          if (!condition) {
            condition = new Condition();
            this._stateConditions.set(name, condition);
          }

          return condition.whenTrue();
        }
      };
    }
  }

  /**
   * Dispatches the given event.
   *
   * @param {Functor} event The event.
   */
  async _dispatchEvent(event) {
    const stateName = this._stateName;
    const log       = this._log;

    // Log the state name and event details (if not squelched), and occasional
    // count of how many events have been handled so far.

    if (this._verboseLogging) {
      log.event.dequeued(event);
    }

    // Dispatch the event. In case of exception, enqueue an `error` event.
    // (The default handler for the event will log an error and stop the queue.)
    try {
      await this._handlers[stateName][event.name].apply(this, event.args);
    } catch (e) {
      if (event.name === 'error') {
        // We got an exception in an error event handler. This is the signal to
        // abandon ship.
        log.error('Aborting state machine.', e);
        this._eventQueue = null;
        this._anyEventPending.value = true; // "Wakes up" the servicer.
        return;
      } else {
        this.q_error(e);
      }
    }

    this._eventCount++;
    if ((this._eventCount % 25) === 0) {
      log.event.eventsHandled(this._eventCount);
    }
  }

  /**
   * Dispatches the first event on the queue. If the queue is empty, waits for
   * an event to be enqueued, or for the instance to be shut down.
   *
   * @returns {boolean} `true` iff the instance should still be considered
   *   active; `false` means it is being shut down.
   */
  async _dispatchOne() {
    for (;;) {
      // Check to see if we're done (either idle or shutting down).
      if (this._eventQueue === null) {
        // Shutting down.
        return false;
      } else if (this._eventQueue.length === 0) {
        // Idle.
        this._anyEventPending.value = false;
        await this._anyEventPending.whenTrue();
      } else {
        // There's an event!
        break;
      }
    }

    // Grab the first event on the queue, and dispatch it.
    const event = this._eventQueue.shift();
    await this._dispatchEvent(event);

    // The instance is still active.
    return true;
  }

  /**
   * Constructs a two-level map from each state-event pair to the method which
   * handles that pair.
   *
   * @returns {object<string,object<string,function>>} The handler map.
   */
  _makeHandlerMap() {
    const result       = {}; // Built-up result.
    const stateNameMap = {}; // Map with state name keys (not including `any`).

    // First pass: Find all methods with the right name form, including those
    // with `any` (wildcard) names.
    const matcher = /^_handle_([a-zA-Z0-9]+)_([a-zA-Z0-9]+)$/;
    const iter    = new PropertyIterable(this).onlyMethods().onlyNames(matcher);
    for (const desc of iter) {
      const match     = desc.name.match(matcher); // **TODO:** Ideally we'd avoid re-running the regex.
      const stateName = match[1];
      const eventName = match[2];

      if ((eventName !== 'any') && !this._eventValidators[eventName]) {
        // No associated validator.
        throw Errors.badUse(`Unknown event name ${eventName} in method ${desc.name}.`);
      }

      if (!result[stateName]) {
        result[stateName] = {};
      }

      result[stateName][eventName] = desc.value;

      if (stateName !== 'any') {
        stateNameMap[stateName] = true;
      }
    }

    // These _don't_ include `any`.
    const states = Object.keys(stateNameMap);          // List of state names.
    const events = Object.keys(this._eventValidators); // List of event names.

    // In the second layer, find `any` bindings, and use them to fill out their
    // state. **Note:** For the outer loop, we want to process the `any` state
    // handler map and do so first so that its results are available during
    // subsequent iterations. Also note, because this class defines an `any_any`
    // handler, we know we'll have a top-level `any` entry.
    for (const state of ['any', ...states]) {
      const eventHandlers = result[state];
      const anyHandler = result[state].any;
      for (const event of events) {
        if (result[state][event]) {
          // The handler for the (state, event) pair is defined directly.
          continue;
        } else if (anyHandler) {
          // There is a default handler for the state. Bind a function that
          // calls through to it with an extra first arg for the event name.
          result[state][event] = (...args) => {
            anyHandler.call(this, event, ...args);
          };
        } else {
          // Use the default handler for the event. By construction, this will
          // end up using the (any, any) handler where there is no more specific
          // default.
          result[state][event] = result.any[event];
        }
      }

      delete eventHandlers.any; // Don't represent `any` in the final result.
    }

    delete result.any; // Don't represent `any` in the final result.

    return result;
  }

  /**
   * Constructs a map from each valid event name to its respective event
   * validator method.
   *
   * @returns {object} The event validator map.
   */
  _makeValidatorMap() {
    const result = {}; // Built-up result.

    const matcher = /^_check_([a-zA-Z0-9]+)$/;
    const iter    = new PropertyIterable(this).onlyMethods().onlyNames(matcher);
    for (const desc of iter) {
      const match     = desc.name.match(matcher); // **TODO:** Ideally we'd avoid re-running the regex.
      const eventName = match[1];

      result[eventName] = desc.value;
    }

    return result;
  }

  /**
   * Services the event queue. This waits for the queue to be non-empty (via a
   * promise), dispatches all events, and then iterates. It stops only when
   * the instance has gotten halted (most likely due to an external error).
   */
  async _serviceEventQueue() {
    this._log.event.running();

    for (;;) {
      const stillActive = await this._dispatchOne();
      if (!stillActive) {
        break;
      }
    }

    this._log.event.stopped();
  }

  /**
   * Validates an `error` event.
   *
   * @param {Error} error The error.
   */
  _check_error(error) {
    TObject.check(error, Error);
  }

  /**
   * Default handler for any event in any state, which responds by throwing a
   * `badUse` error, because subclasses should cover all the event
   * possibilities. This may be overridden by subclasses if in fact having a
   * wildcard handler is the right tactic for their particular case.
   *
   * @param {string} name The event name.
   * @param {...*} args_unused Arguments to the event.
   * @throws {Errors.badUse} Always thrown.
   */
  _handle_any_any(name, ...args_unused) {
    throw Errors.badUse(`Cannot handle event \`${name}\` in state \`${this._stateName}\`.`);
  }

  /**
   * Default handler for `error` events in any state, which responds by aborting
   * this instance. This may be overridden by subclasses.
   *
   * **Note:** `error` events are only expected to be issued in response to
   * other event handlers throwing errors back to the dispatcher. This handler
   * is the handler of "last resort" for such errors.
   *
   * @param {Error} error The error.
   * @throws {Errors.aborted} Always thrown.
   */
  _handle_any_error(error) {
    this._log.error('Error in handler', error);
    throw Errors.aborted(error, 'State machine shut down due to uncaught error.');
  }
}
