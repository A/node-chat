// Any files in this directory will be `require()`'ed when the application
// starts, and the exported function will be invoked with a `this` context of
// the application itself.  Initializers are used to connect to databases and
// message queues, and configure sub-systems such as authentication.

// Async initializers are declared by exporting `function(done) { /*...*/ }`.
// `done` is a callback which must be invoked when the initializer is
// finished.  Initializers are invoked sequentially, ensuring that the
// previous one has completed before the next one executes.


'use strict';

/**
 * Module dependencies.
 */
var config              = require('nconf');
var log                 = require('microlog')(module);
var pwd                 = require('process-pwd');

// end of dependencies.


module.exports = function (done) {
  config.env(['HOST', 'PORT', 'SOCKET_PORT', 'MONGODB']);
  config.defaults({
    HOST: '0.0.0.0',
    PORT: 3000,
    SOCKET_PORT: 8000,
    MONGODB: '0.0.0.0/just-chat',
    SMSSENDER_CREDENTIALS: 'qwerty:qwerty',
    UPLOAD_DIR: './public/uploads',
    SECRET: 'keyboardragon',
    CREDENTIALS: 'basic:auth',
    SMS_MESSAGE: '%n — код для входа в ПростоЧат.'
  });
  done();
};
