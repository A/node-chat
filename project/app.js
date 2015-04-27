'use strict';

/**
 * Module dependencies.
 */

var log                      = require('microlog')(module);
var config                   = require('nconf');

var express                  = require('express');
var bootable                 = require('bootable');
    bootable.environments    = require('bootable-environment');

// End of dependencies.



var app = module.exports = bootable(express());

// Setup initializers
app.phase(bootable.initializers('setup/initializers', app));

// Setup models
app.phase(bootable.initializers('models', app));

// Setup environments
app.phase(bootable.environments('setup/environments', app));

// Setup routes
app.phase(bootable.routes('routes', app));


// Boot app
module.parent || app.boot(function(err) {
  if (err) { throw err; }
  app.listen(config.get('PORT'), config.get('HOST'), function() {
    log.info('Express listen %s host and %d port', config.get('HOST'), config.get('PORT'));
  });
});
