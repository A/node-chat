'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var Room                = require('mongoose').model('Room');
var Complaint           = require('mongoose').model('Complaint');
var Message             = require('mongoose').model('Message'); // ? 
var User                = require('mongoose').model('User'); // ?


// End of dependencies.

exports.create = function () {
  return function (req, res) {
    var messageID = req.body.message;
    if (!messageID) { return res.json(400, {error: 'message id is undefined'}); }
    Room.findOne({'chat._id': messageID, 'users': req.user._id}, {'chat.$': 1}, function (err, room) {
      if (err) { return res.json(500, {error: err.message}); }
      if (!room) { return res.json(404, {error: 'Massage not found in your active chat'}); }
        var message = room.chat[0];
        var complaint = new Complaint({
          author: req.user._id,
          room: room._id,
          message: message,
          text: req.body.text
        });
        complaint.save(function (err, complaint) {
          err
            ? res.json(500, {error: err.message})
            : res.json({
                data: {
                  complaint: complaint
                }
              });
        });
    });
  };
};


exports.get = function () {
  return function (req, res) {
    Complaint.find({room: req.body.room}, function (err, complaints) {
      err
        ? res.json(500, {error: err.message})
        : res.json({
            data: {
              complaints: complaints
            }
          });
    });
  };
};