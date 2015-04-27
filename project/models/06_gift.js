'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var MessageSchema       = mongoose.model('Message').schema;


// End of dependencies.


var GiftSchema = new mongoose.Schema({
  name: String,
  image: String,
  price: Number,
  create_at: {
    type: Date,
    default: Date.now
  }
});

mongoose.model('Gift', GiftSchema);