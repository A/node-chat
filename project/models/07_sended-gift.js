'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var MessageSchema       = mongoose.model('Message').schema;


// End of dependencies.


var SendedGiftSchema = new mongoose.Schema({
  name: String,
  image: String,
  text: String,
  price: Number,
  create_at: {
    type: Date,
    default: Date.now
  },
  author: {
    type: String,
    ref: 'User'
  }
});

mongoose.model('SendedGift', SendedGiftSchema);