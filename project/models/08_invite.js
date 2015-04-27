'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');

// End of dependencies.


var InviteSchema = new mongoose.Schema({
  phone: {
    type: Number,
    unique: true
  },
  author: {
    type: String,
    ref: 'User'
  },
  closed: Boolean
});

mongoose.model('Invite', InviteSchema);