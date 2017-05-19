// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import fs from 'fs';
import { after, before, describe, it } from 'mocha';
import path from 'path';

import { Timestamp } from 'doc-common';
import { LocalDoc } from 'doc-store-local';

const STORE_PREFIX = 'arugula-test-';
let storeDir = null;

describe('doc-store-local/LocalDoc', () => {
  before(() => {
    storeDir = fs.mkdtempSync(STORE_PREFIX);
  });

  // The expectation was that this would run after all tests were finish and
  // clean up the directory into which we are writing test files. However, since
  // it takes as much as 5 seconds for any `LocalDoc` files to be written to
  // disk, it's not safe to `rmdir` the directory. Mocha has an internal rule
  // that you can't take more than 2 seconds to finish your work in the
  // `after()` hook and call the `done()` callback.
  after(function (done) {
    // setTimeout(() => {
    //   fs.rmdirSync(storeDir);
    //   storeDir = null;

    done();
    // }, 2000);
  });

  describe('constructor(formatVersion, docId, docPath)', () => {
    it('should create a local dir for storing files at the specified path', () => {
      const doc = new LocalDoc('0', '0', documentPath());

      assert.isNotNull(doc);
    });
  });

  describe('changeAppend(change)', () => {
    it('should increment the version after a change is applied', () => {
      const doc = new LocalDoc('0', '0', documentPath());
      const oldVersion = doc.currentVerNum();

      // Docs start off with a null version number
      assert.isNull(oldVersion);
      addChangeToDocument(doc);

      let newVersion = doc.currentVerNum();

      assert.strictEqual(newVersion, 0);

      addChangeToDocument(doc);
      newVersion = doc.currentVerNum();
      assert.strictEqual(newVersion, 1);
    });

    // Need a good way to test this with a delay. Documents don't resolve a Promise
    // or send an event when written so there's no way for the test code to know
    // when to check.
    //
    // it('should exist on disk after a write', () => {
    //   const doc = new LocalDoc('0', '0', documentPath());
    //
    //   addChangeToDocument(doc);
    //
    //   assert.isTrue(doc.exists());
    // });
  });

  describe('create()', () => {
    it('should erase the document if called on a non-empty document', () => {
      const doc = new LocalDoc('0', '0', documentPath());

      addChangeToDocument(doc);
      assert.strictEqual(doc.currentVerNum(), 0); // Baseline assumption.

      doc.create();
      assert.isNull(doc.currentVerNum()); // The real test.
    });
  });
});

function documentPath() {
  return storeDir + path.sep + 'test_file';
}

function addChangeToDocument(doc) {
  const ts = Timestamp.now();
  const changes = [{ 'insert': 'hold on to your butts!' }];

  doc.changeAppend(ts, changes, null);
}
