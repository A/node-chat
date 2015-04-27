'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var extend              = require('extend');

// End of dependencies.


exports.get = function () {
  return function (req, res) {
    mongoose
      .model('Gift')
      .find(null, function (err, gifts) {
        res.json(200, {
          data: {
            gifts: gifts
          }
        });
      });
  };
};


exports.send = function (sio) {
  return function (req, res) {
    // Найти подарок
    mongoose
      .model('Gift')
      .findOne({_id: req.body.gift})
      .lean()
      .exec(function (err, gift) {
        err
          ? res.json(500, {error: err.message})
          : newSendedGift(gift, req.body.user, req.user._id).save(function (err, gift) {
              mongoose
                .model('User')
                .findOne({_id: req.body.user}, function (err, user) {
                  req.user.balance = req.user.balance - gift.price;
                  if (req.user.balance < 0 ) {
                    return res.json(402, {error: 'Not enough money'});
                  } else {
                    req.user.save();
                    notifyRoom(sio, req.user, user);
                    user.gifts.push(gift._id);
                    user.save(function (err) {
                      err
                        ? res.json(500, {error: err.message})
                        : res.json(200, {data: {gift: gift}});
                    });
                  }
                });
            });
      });
  };
};


var newSendedGift = exports.sendNewGift = function (parentGift, user, author) {
  delete parentGift._id;
  delete parentGift.create_at;
  var Gift = mongoose.model('SendedGift');
  return new Gift(extend({author: author,user: user}, parentGift));
};


var notifyRoom = function (sio, author, user) {
  return author.room === user.room
    ? mongoose
        .model('Room')
        .findById(user.room)
        .select('users')
        .exec(function (err, room) {
          if (err) { return err; }
          var Message = mongoose.model('Message');
          var message = new Message({
            author: author._id,
            user: user._id,
            room: author.room
          });
          room.notify(sio, 'gift-message', {data: {message: message}});
        })
    : false;
};