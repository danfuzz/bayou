// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Connection with the server, via a websocket.
 */

export default class ApiClient {
  constructor(url) {
    url = new URL(url);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`.
    url.pathname = '/api';

    // Clear out any post-path bits.
    url.search = '';
    url.hash = '';

    this.url = url.href;
  }

  test() {
    var url = this.url;
    var ws = new WebSocket(url);
    var pendingCount = 3;
    ws.onopen = function (event) {
      ws.send('{"method": "test", "args": [1]}');
      ws.send('{"method": "test", "args": [2]}');
      ws.send('{"method": "test", "args": [3]}');
    };
    ws.onmessage = function (event) {
      console.log('API received');
      console.log(event.data);
      pendingCount--;
      if (pendingCount === 0) {
        ws.close();
      }
    };
  }
};
