'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var MessageSchema       = mongoose.model('Message').schema;


// End of dependencies.


var ComplaintSchema = new mongoose.Schema({
  author: {
    type: String,
    ref: 'User'
  },
  room: {
    type: String,
    ref: 'Room'
  },
  text: String,
  create_at: {
    type: Date,
    default: Date.now
  },
  message: [MessageSchema]
});

mongoose.model('Complaint', ComplaintSchema);