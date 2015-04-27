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
var log                 = require('microlog')(module);
var config              = require('nconf');

var requireTree         = require('require-tree');
// var models              = requireTree('../../models/');
var mongoose            = require('mongoose');

// End of dependencies.


module.exports = function (done) {
  var MONGODBURI        = config.get('MONGODB');

  mongoose.connection.on('open', function () {
    log.info('Connected to %s db!', MONGODBURI);
    return done();
  });

  mongoose.connection.on('error', function (err) {
    log.error('Could not connect to db!', err.message);
    done(err);
    return err;
  });

  mongoose.connect(MONGODBURI);

};