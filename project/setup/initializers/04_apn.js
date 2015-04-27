'use strict';

/**
 * Module dependencies.
 */
var log                      = require('microlog')(module);
var config                   = require('nconf');

var apn                      = require('apn');

// End of dependencies.


module.exports = function (done) {
  this.apn = apn;
  this.apnConnection = new apn.Connection({'gateway': 'gateway.push.apple.com'});

  done();
};