// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Utilities for application-related URLs.
 */
export class Urls extends UtilityClass {
  /**
   * {string} The partial path off of a base URL which corresponds to an API
   * endpoint. This value does _not_ start or end with a slash (`/`).
   */
  static get API_PATH() {
    return 'api';
  }

  /**
   * Gets the API endpoint given a base URL.
   *
   * @param {string} baseUrl The base URL for an application.
   * @returns {string} The corresponding API endpoint URL.
   */
  static apiUrlFromBaseUrl(baseUrl) {
    TString.check(baseUrl);

    // Accept a URL without any path, by appending a final `/` if not present.
    // `urlAbsolute` demands that a path be present.
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    TString.urlAbsolute(baseUrl);

    // No `/` here, because we guaranteed `baseUrl` ends with one, above.
    return `${baseUrl}${Urls.API_PATH}`;
  }

  /**
   * Gets the base URL given corresponding to the given API endpoint URL.
   *
   * @param {string} apiUrl The API endpoint URL for an application.
   * @returns {string} The corresponding base URL.
   */
  static baseUrlFromApiUrl(apiUrl) {
    TString.urlAbsolute(apiUrl);

    const result = apiUrl.replace(/[/]+api[/]*$/, '');

    if (result === apiUrl) {
      throw Errors.badValue(apiUrl, String, 'API URL');
    }

    return result;
  }
}
