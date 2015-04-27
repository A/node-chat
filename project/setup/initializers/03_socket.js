'use strict';

/**
 * Module dependencies.
 */
var log                      = require('microlog')(module);
var config                   = require('nconf');
var http                     = require('http');
var io                       = require('socket.io');

// End of dependencies.


module.exports = function (done) {
  var server = require('http')
    .createServer()
    .listen(config.get('SOCKET_PORT'), config.get('HOST'));

  this.io = io.listen(server, {
    'log level': 0
  });

  done();
};