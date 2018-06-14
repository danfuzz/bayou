// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

import { Dirs } from '@bayou/env-server';
import { Logger } from '@bayou/see-all';
import { JsonUtil, Singleton } from '@bayou/util-common';

import ProgressMessage from './ProgressMessage';

/** {string} Path to the client `node_modules` directory. */
const NODE_MODULES_DIR = path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules');

/** {string} Path to the `main-client` module directory. */
const MAIN_CLIENT_DIR = path.resolve(NODE_MODULES_DIR, '@bayou/main-client');

/**
 * {object} The parsed `package.json` for the client. This is used for some of
 * the `webpack` config.
 */
const clientPackage =
  JsonUtil.parseFrozen(
    fs.readFileSync(path.resolve(MAIN_CLIENT_DIR, 'package.json')));

/**
 * Utility class which provides the Webpack configuration needed for client
 * builds.
 */
export default class WebpackConfig extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {Logger} Logger for this module. */
    this.log = new Logger('client-bundle');

    /**
     * {ProgressMessage} Handler that logs progress messages during compilation.
     */
    this.progress = new ProgressMessage(this.log);

    Object.freeze(this);
  }

  /**
   * {object} Options passed to the `webpack` compiler constructor. Of
   * particular note, we _do not_ try to restrict the loaders to any particular
   * directories (e.g. via `include` configs), instead _just_ applying them
   * based on filename extension. As such, any `.js` file will get loaded via
   * our "modern ES" pipeline, and any `.ts` file will get loaded via the
   * TypeScript loader.
   *
   * **Note** about `require.resolve()` as used below: Babel doesn't respect the
   * Webpack `context` option. Because we treat the `client` and `server` as
   * peers (that is, because the server modules aren't in a super-directory of
   * `client`), we have to "manually" resolve the presets. See
   * <https://github.com/babel/babel-loader/issues/149>,
   * <https://github.com/babel/babel-loader/issues/166>, and
   * <http://stackoverflow.com/questions/34574403/how-to-set-resolve-for-babel-loader-presets/>
   * for details and discussion.
   */
  get webpackConfig() {
    return {
      // Used for resolving loaders and the like.
      context: Dirs.theOne.SERVER_DIR,

      // `inline-source-map` _should_ work, but for some reason doesn't seem to.
      // Using `cheap-module-eval-source-map` _does_ work on Chrome (v60) but
      // causes inscrutable problems on Safari (v10.1.2). **TODO:** Investigate
      // this.
      devtool: 'inline-source-map',

      // We use `development` mode here, in that this module is the thing that
      // does live (re-)building of the client code. For production, the
      // expectation is that the client code will get built as part of the
      // offline build process.
      mode: 'development',

      entry: {
        main: [
          'babel-polyfill',
          path.resolve(MAIN_CLIENT_DIR, clientPackage.main)
        ],
        test: [
          'babel-polyfill',
          path.resolve(MAIN_CLIENT_DIR, clientPackage.testMain)
        ]
      },

      output: {
        // Absolute output path of `/` because we write to a memory filesystem.
        // And no `.js` suffix, because the memory filesystem contents aren't
        // served out directly but just serve as an intermediate waystation. See
        // {@link ClientBundle#_handleCompilation} for more details.
        path: '/',
        filename: '[name]',
        publicPath: '/static/js/'
      },

      plugins: [
        new webpack.ProgressPlugin(this.progress.handler)
      ],

      resolve: {
        alias: {
          // The `quill` module as published exports an entry point which
          // references a prebuilt bundle. We rewrite it here to refer instead
          // to the unbundled source.
          'quill':
            path.resolve(NODE_MODULES_DIR, 'quill/quill.js'),

          // Likewise, `parchment`.
          'parchment':
            path.resolve(NODE_MODULES_DIR, 'parchment/src/parchment.ts'),

          // On the client side, we use the local module
          // {@link @bayou/mocha-client-shim} as a substitute for `mocha`, and
          // that module refers to `mocha-client-bundle`. These two aliases
          // makes it so that unit test code can still write `import ... from
          // 'mocha';`.
          'mocha':
            path.resolve(NODE_MODULES_DIR, '@bayou/mocha-client-shim'),
          'mocha-client-bundle':
            path.resolve(NODE_MODULES_DIR, 'mocha/mocha.js')
        },

        // All the extensions listed here except `.ts` are in the default list.
        // Webpack doesn't offer a way to simply add to the defaults (alas).
        extensions: ['.webpack.js', '.web.js', '.js', '.ts']
      },

      module: {
        rules: [
          // Convert JavaScript from the modern syntax that we use to what is
          // supported by the browsers / environments we target.
          {
            test: /\.js$/,
            use: [{
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    require.resolve('babel-preset-env'),
                    {
                      sourceMaps: 'inline',
                      targets: {
                        browsers: [
                          // See <https://github.com/ai/browserslist> for the
                          // syntax used here.
                          'Chrome >= 61',
                          'ChromeAndroid >= 61',
                          'Electron >= 1.8',
                          'Firefox >= 54',
                          'iOS >= 11',
                          'Safari >= 11'
                        ]
                      }
                    }
                  ],
                  [
                    require.resolve('babel-preset-react')
                  ]
                ]
              }
            }]
          },

          // Enable pass-through of the Babel-provided source maps.
          {
            test: /\.js$/,
            enforce: 'pre',
            use: [{ loader: 'source-map-loader' }]
          },

          // This handles dynamic construction of the main test-collector file,
          // for client-side unit testing.
          {
            test: /@bayou[/]testing-client[/]client-tests$/,
            use: [{
              loader: '@bayou/testing-server/loadClientTests'
            }]
          },

          // Convert TypeScript files. As of this writing, this is only required
          // for Parchment (a dependency of Quill).
          {
            test: /\.ts$/,
            use: [{
              loader: 'ts-loader',
              options: {
                compilerOptions: {
                  // A reasonably conservative choice, and also recapitulates
                  // what Parchment's `tsconfig.json` specifies.
                  target: 'es5',
                  // Parchment specifies this as `true`, but we need it to be
                  // `false` because we _aren't_ building it as a standalone
                  // library.
                  declaration: false
                },
                silent: true, // Avoids the banner spew.
                transpileOnly: true
              }
            }]
          },

          // Support `import` / `require()` of SVG files. As of this writing,
          // this is only needed by Quill. The configuration here recapitulates
          // how Quill is set up to process those assets. See
          // <https://github.com/quilljs/quill/blob/develop/_develop/webpack.config.js>.
          {
            test: /\.svg$/,
            use: [{
              loader: 'html-loader',
              options: {
                minimize: true
              }
            }]
          },

          {
            test: /\.module.less$/,
            use: [
              {
                loader: 'style-loader'
              },
              {
                loader: 'css-loader',
                options: { modules: true }
              },
              {
                loader: 'less-loader'
              }
            ]
          },

          {
            test: /^((?!\.module).)*less$/,
            use: [
              {
                loader: 'style-loader'
              },
              {
                loader: 'css-loader'
              },
              {
                loader: 'less-loader'
              }
            ]
          },

          // This makes `.css` files `import`able into our JavaScript code.
          // Doing so injects the CSS into the DOM (currently configured to add
          // a `<style>` element to the `<head>`). This allows us to easily
          // break all of our CSS files into multiple modules and only load them
          // when needed. As part of this process each class name is transformed
          // to be a unique random string.
          {
            test: /\.css$/,
            use: [
              {
                loader: 'style-loader'
              },
              {
                loader: 'css-loader'
              }
            ]
          },

          // Same as `.css` handling above but reference counts the objects
          // loaded into JavaScript. Calling `style.use()` increments the count,
          // and `style.unuse()` decrements the count. Whenever the count is
          // greater than zero the styles are active in the DOM. When it is zero
          // the styles are removed. See `README.md` in this directory
          // for examples.
          {
            test: /.ucss$/,
            use: [
              {
                loader: 'style-loader/useable'
              },
              {
                loader: 'css-loader'
              }
            ]
          }
        ]
      }
    };
  }

  /** {object} Options passed to `compiler.watch()`. */
  get watchConfig() {
    return {
      // Wait up to this many msec after detecting a changed file. This helps
      // prevent a rebuild from starting while in the middle of a file save.
      aggregateTimeout: 1000
    };
  }
}
