'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');

// End of dependencies.


var SessionSchema = new mongoose.Schema({
  user: {
    type: String,
    ref: 'User'
  },
  sockets: [],
  ios_tokens: []
});

mongoose.model('Session', SessionSchema);