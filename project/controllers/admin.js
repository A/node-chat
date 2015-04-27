'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var User                = require('mongoose').model('User');
var Message             = require('mongoose').model('Message');
var Session             = require('mongoose').model('Session');
var Countdown           = require('next-done');
var env                 = process.env.NODE_ENV;

// End of dependencies.


exports.users = function () {
  return function (req, res) {
    var limit = req.query.limit || 20;
    var page  = req.query.page * 1 || 1;
    var skip  = limit * (page - 1);
    var query = {};
    if (req.query.search) {
      isNaN(req.query.search*1)
        ? (query.nickname = new RegExp(req.query.search, 'i'))
        : (query.phone = req.query.search * 1);
    }
    mongoose
      .model('User')
      .find(query)
      .count()
      .exec(function (err, count) {
        mongoose
          .model('User')
          .find(query)
          .sort('-create_at')
          .skip(skip)
          .limit(limit)
          .exec(function (err, users) {
            res.render('users', {
              count: count,
              limit: limit,
              page: page,
              pages: (count % limit)
                ? (count / limit |0) + 1
                : count / limit,
              users: users
            });
          });
      });
  };
};

exports.user = function () {
  return function (req, res) {
    mongoose
      .model('User')
      .findById(req.params.userId, function (err, user) {
        res.render('user', {user: user});
      });
  };
};

exports.updateUser = function () {
  return function (req, res) {
    mongoose
      .model('User')
      .findOneAndUpdate({_id: req.params.userId}, req.body, function (err, user) {
        res.redirect('/admin/users/' + req.params.userId);
      });
  };
};


exports.deleteUser = function () {
  return function (req, res) {
    mongoose
      .model('User')
      .findOneAndRemove({_id: req.params.userId}, req.body, function (err, user) {
        res.redirect('/admin/users/');
      });
  };
};


exports.rooms = function () {
  return function (req, res) {
    mongoose
      .model('Room')
      .find(null)
      .populate('users admin')
      .exec(function (err, rooms) {
        res.render('rooms', {rooms: rooms});
      });
  };
};


exports.getUsers = function () {
  return function (req, res) {
    mongoose
      .model('User')
      .find(null, function (err, users) {
        res.json(200, users);
      });
  };
};


exports.newGiftForm = function () {
  return function (req, res) {
    res.render('new-gift');
  };
};


exports.createGift = function () {
  return function (req, res) {
    console.log('create gift');
    console.log(req.body);
    var Gift = mongoose.model('Gift');
    var gift = new Gift(req.body);
    gift.image = req.files.img.path.replace('public', '');
    gift.save(function () {
      res.redirect('/admin/gifts');
    });
  };
};


exports.removeGift = function () {
  return function (req, res) {
    mongoose
      .model('Gift')
      .remove({_id: req.params.giftId}, function (err, removed) {
        res.redirect('/admin/gifts');
      });
  };
};


exports.giftsPage = function () {
  return function (req, res) {
    mongoose
      .model('Gift')
      .find(null, function (err, gifts) {
        res.render('gifts', {gifts: gifts});
      });
  };
};


exports.updateGiftPage = function () {
  return function (req, res) {
    mongoose
      .model('Gift')
      .findById(req.params.giftId, function (err, gift) {
        res.render('edit-gift', {gift: gift});
      });
  };
};


exports.updateGift = function () {
  return function (req, res) {
    mongoose
      .model('Gift')
      .findById(req.params.giftId, function (err, gift) {
        if (req.body.name) { gift.name = req.body.name; }
        if (req.body.price) { gift.price = req.body.price; }
        if (req.files && req.files.img && req.files.img.size) {
          gift.image = req.files.img.path.replace('public', '');
        }
        gift.save(function () {
          res.redirect('/admin/gifts');
        });
      });
  };
};


exports.updateRoom = function () {
  return function (req, res) {
    if (!req.body.admin) { return res.redirect('/admin/rooms/'); }
    mongoose
      .model('User')
      .findOne({phone: req.body.admin})
      .exec(function (err, user) {
        if (!user) { return res.redirect('/admin/rooms/'); }
        mongoose
          .model('Room')
          .update({_id: req.params.roomId}, {admin: user._id.toString()}, function (err, updated) {
            res.redirect('/admin/rooms/');
          });
      });
  };
};


exports.removeRoom = function () {
  return function (req, res) { 
    mongoose
      .model('Room')
      .remove({_id: req.params.room_id}, function (err) {
        mongoose
          .model('User')
          .where({ visitedRooms: req.params.room_id })
          .update({ $pull: {visitedRooms: req.params.room_id} }, { multi: true });
        res.redirect('/admin/rooms');
      });
  };
};



exports.stats = function () {
  return function (req, res) {
    var MS_PER_MINUTE = 60000;
    var time = new Date();
    var next = new Countdown(4, function (err) {
      return res.render('stats');
    });
    // Пользователи
    mongoose
      .model('User')
      .count()
      .exec(function (err, users) {
        res.locals.users = users;
        next();
      });
    // Активные пользователи
    mongoose
      .model('User')
      .where({updatedAt: {$gte: new Date(time - 15 * MS_PER_MINUTE)}}) // Поиск по дате
      .count()
      .exec(function (err, activeUsers) {
        res.locals.activeUsers = activeUsers;
        next();
      });
    // Подаренные подарки
    mongoose
      .model('Gift')
      .count()
      .exec(function (err, gifts) {
        res.locals.gifts = gifts;
        next();
      });
    // Подаренные подарки
    mongoose
      .model('Room')
      .count()
      .exec(function (err, rooms) {
        res.locals.rooms = rooms;
        next();
      });
  };
};
